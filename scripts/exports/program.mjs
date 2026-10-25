import fs from "node:fs";
import path from "node:path";
import ts from "@typescript/typescript6";

export function createExportProgram(root, files, options = {}, virtualSources = new Map()) {
  const host = ts.createCompilerHost(options);
  const read = host.readFile, exists = host.fileExists, directoryExists = host.directoryExists;
  const virtualDirectories = new Set();
  for (const file of virtualSources.keys()) for (let directory = path.dirname(file); within(root, directory); directory = path.dirname(directory)) {
    virtualDirectories.add(directory);
    if (directory === path.resolve(root)) break;
  }
  host.fileExists = file => virtualSources.has(path.resolve(file)) || exists(file);
  host.directoryExists = directory => virtualDirectories.has(path.resolve(directory)) || directoryExists(directory);
  const bridges = [], bridgeErrors = new Set();
  host.readFile = file => {
    const source = virtualSources.get(path.resolve(file)) ?? read(file);
    if (source === undefined || !within(root, file) || !/\.(?:ts|mjs|js)$/.test(file)) return source;
    try { return bridgeTestImports(file, source, root, bridges, host.fileExists); }
    catch (error) { bridgeErrors.add(error.message); return source; }
  };
  const program = ts.createProgram(files, options, host);
  // The compiler host can absorb read errors; surface bridge failures explicitly.
  if (bridgeErrors.size) throw new Error([...bridgeErrors].join("\n"));
  return { program, bridges };
}

export function collectModules(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(root, entry.name);
    return entry.isDirectory() ? collectModules(file) : /\.(?:ts|mjs|js)$/.test(file) && !file.endsWith(".d.ts") ? [file] : [];
  });
}

export function within(root, file) {
  const relative = path.relative(path.resolve(root), path.resolve(file));
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

// Analysis-only imports connect existing temporary test runtimes to their TS sources.
// No test or production file is rewritten on disk.
function bridgeTestImports(file, source, root, bridges, exists) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const loaders = new Set(), wrappers = new Set(), edits = [];
  const runtime = path.join(root, "scripts/app-contracts/runtime.mjs");
  function temporaryArgument(node) {
    if (!ts.isCallExpression(node) || node.expression.kind !== ts.SyntaxKind.ImportKeyword) return;
    const href = node.arguments[0];
    if (!href || !ts.isPropertyAccessExpression(href) || href.name.text !== "href") return;
    const url = href.expression;
    if (!ts.isCallExpression(url) || url.expression.getText(ast) !== "pathToFileURL") return;
    const join = url.arguments[0];
    if (join && ts.isCallExpression(join) && ts.isPropertyAccessExpression(join.expression) && join.expression.name.text === "join") {
      return join.arguments.at(-1);
    }
  }
  for (const statement of ast.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) &&
      path.resolve(path.dirname(file), statement.moduleSpecifier.text) === runtime) {
      const bindings = statement.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) for (const specifier of bindings.elements) {
        if ((specifier.propertyName ?? specifier.name).text === "loadModule") loaders.add(specifier.name.text);
      }
    }
  }
  function findWrappers(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isArrowFunction(node.initializer)) {
      const arrow = node.initializer, argument = temporaryArgument(arrow.body);
      if (argument && ts.isIdentifier(argument) && arrow.parameters.length === 1 && arrow.parameters[0].name.getText(ast) === argument.text) {
        wrappers.add(node.name.text);
      }
    }
    ts.forEachChild(node, findWrappers);
  }
  findWrappers(ast);
  function visit(node) {
    let argument;
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && (loaders.has(node.expression.text) || wrappers.has(node.expression.text))) {
      argument = node.arguments[0];
      if (!argument || !ts.isStringLiteralLike(argument)) throw new Error(`Test import needs a literal module path in ${file}`);
    } else argument = temporaryArgument(node);
    if (argument && ts.isStringLiteralLike(argument)) {
      const relative = argument.text.replace(/^src\//, "").replace(/\.js$/, ".ts");
      const target = path.resolve(root, "src", relative);
      if (!within(path.join(root, "src"), target) || !exists(target)) {
        throw new Error(`Cannot map test import ${JSON.stringify(argument.text)} in ${file}`);
      }
      let specifier = path.relative(path.dirname(file), target).replaceAll(path.sep, "/");
      if (!specifier.startsWith(".")) specifier = `./${specifier}`;
      const imported = `import(${JSON.stringify(specifier)})`;
      const text = node.expression.kind === ts.SyntaxKind.ImportKeyword ? imported : `(${node.expression.getText(ast)}, ${imported})`;
      edits.push({ start: node.getStart(ast), end: node.end, text });
      bridges.push({ importer: file, target });
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  for (const edit of edits.sort((a, b) => b.start - a.start)) source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
  return source;
}
