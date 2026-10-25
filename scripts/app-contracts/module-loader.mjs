import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "@typescript/typescript6";

// Each test runtime owns its output directory and registers doubles before the first load.
export function createModuleLoader({ sourceRoot, outputRoot }) {
  sourceRoot = path.resolve(sourceRoot);
  outputRoot = path.resolve(outputRoot);
  const overrides = new Map();
  const prepared = new Set();
  let started = false;
  let queue = Promise.resolve();

  function sourceFile(file) {
    const absolute = within(sourceRoot, path.resolve(sourceRoot, file));
    if (!absolute.endsWith(".ts")) throw new Error(`Expected a TypeScript test module: ${file}`);
    return absolute;
  }

  function outputFile(file) {
    return path.join(outputRoot, path.relative(sourceRoot, file).replace(/\.ts$/, ".js"));
  }

  function resolveImport(specifier, importer) {
    const base = within(sourceRoot, path.resolve(path.dirname(importer), specifier));
    const candidates = path.extname(base)
      ? [base.replace(/\.js$/, ".ts")]
      : [`${base}.ts`, path.join(base, "index.ts")];
    const resolved = candidates.find(file => file.endsWith(".ts") &&
      (overrides.has(file) || (fs.existsSync(file) && fs.statSync(file).isFile())));
    if (!resolved) throw new Error(`Cannot resolve ${JSON.stringify(specifier)} imported by ${importer}`);
    return resolved;
  }

  async function prepare(file, visited) {
    if (prepared.has(file) || visited.has(file)) return;
    visited.add(file);
    const source = overrides.get(file) ?? await fsPromises.readFile(file, "utf8");
    const result = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        isolatedModules: true,
      },
      fileName: file,
      reportDiagnostics: true,
    });
    if (result.diagnostics?.length) {
      throw new Error(ts.formatDiagnosticsWithColorAndContext(result.diagnostics, {
        getCanonicalFileName: fileName => fileName,
        getCurrentDirectory: () => sourceRoot,
        getNewLine: () => "\n",
      }));
    }
    // Traverse emitted JS: type-only imports have no runtime dependency.
    const emitted = ts.createSourceFile(file, result.outputText, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
    const dependencies = new Set();
    const edits = [];
    function visit(node) {
      let literal;
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) literal = node.moduleSpecifier;
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        literal = node.arguments[0];
        if (!literal || !ts.isStringLiteralLike(literal)) {
          throw new Error(`Non-literal dynamic import is not supported in test modules: ${file}`);
        }
      }
      if (literal && ts.isStringLiteralLike(literal) && /^\.{1,2}\//.test(literal.text)) {
        const dependency = resolveImport(literal.text, file);
        dependencies.add(dependency);
        let relative = path.relative(path.dirname(outputFile(file)), outputFile(dependency)).replaceAll(path.sep, "/");
        if (!relative.startsWith(".")) relative = `./${relative}`;
        edits.push({ start: literal.getStart(emitted), end: literal.end, text: JSON.stringify(relative) });
      }
      ts.forEachChild(node, visit);
    }
    visit(emitted);
    let output = result.outputText;
    for (const edit of edits.sort((a, b) => b.start - a.start)) {
      output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
    }
    const target = outputFile(file);
    await fsPromises.mkdir(path.dirname(target), { recursive: true });
    await fsPromises.writeFile(target, output);
    for (const dependency of dependencies) await prepare(dependency, visited);
  }

  function stubModule(file, source) {
    if (started) throw new Error("Register test doubles before loading modules");
    overrides.set(sourceFile(file), source);
  }

  function loadModule(file) {
    started = true;
    const entry = sourceFile(file);
    const preparation = queue.then(async () => {
      const visited = new Set();
      await prepare(entry, visited);
      for (const dependency of visited) prepared.add(dependency);
    });
    // Serialize preparation without poisoning later loads after a failed graph.
    queue = preparation.catch(() => {});
    return preparation.then(() => import(pathToFileURL(outputFile(entry)).href));
  }

  return { loadModule, stubModule };
}

function within(root, file) {
  const relative = path.relative(root, file);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Test module escapes source root: ${file}`);
  }
  return file;
}
