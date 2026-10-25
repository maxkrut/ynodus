import path from "node:path";
import ts from "@typescript/typescript6";
import { within } from "./program.mjs";

export function analyzeExportUsage(program, roots) {
  const checker = program.getTypeChecker(), modules = new Map(), origins = new Map();
  const records = [], errors = [], escaped = new Set();
  const sources = program.getSourceFiles().filter(source => !source.isDeclarationFile && roots.some(root => within(root, source.fileName)));
  for (const source of sources) {
    const symbol = checker.getSymbolAtLocation(source);
    if (!symbol) continue;
    const entries = new Map();
    for (const exported of checker.getExportsOfModule(symbol)) {
      const record = { file: source.fileName, name: exported.name, symbol: exported, used: false };
      entries.set(record.name, record); records.push(record);
      if (exported.declarations?.some(declaration => declaration.getSourceFile() === source)) {
        if (!origins.has(exported)) origins.set(exported, []);
        origins.get(exported).push(record);
      }
    }
    modules.set(symbol, entries);
  }
  function moduleAt(node) {
    return node && checker.getSymbolAtLocation(node);
  }
  function namespace(node) {
    return modules.get(checker.getTypeAtLocation(node).symbol);
  }
  function markSymbol(symbol, owner) {
    if (!symbol) return;
    for (const record of origins.get(symbol) ?? []) if (record.file !== owner) mark(record);
    const declaration = symbol.declarations?.[0];
    if (declaration && ts.isImportSpecifier(declaration)) {
      const imported = declaration.parent.parent.parent;
      mark(modules.get(moduleAt(imported.moduleSpecifier))?.get((declaration.propertyName ?? declaration.name).text));
    } else if (declaration && ts.isImportClause(declaration)) {
      mark(modules.get(moduleAt(declaration.parent.moduleSpecifier))?.get("default"));
    }
  }
  function mark(record) {
    if (!record || record.used) return;
    record.used = true;
    const declaration = record.symbol.declarations?.[0];
    if (declaration && ts.isExportSpecifier(declaration)) {
      const exported = declaration.parent.parent;
      if (exported.moduleSpecifier) {
        mark(modules.get(moduleAt(exported.moduleSpecifier))?.get((declaration.propertyName ?? declaration.name).text));
      } else markSymbol(checker.getExportSpecifierLocalTargetSymbol(declaration), record.file);
    }
    if (record.symbol.flags & ts.SymbolFlags.Alias) markSymbol(checker.getAliasedSymbol(record.symbol), record.file);
    else markSymbol(record.symbol, record.file);
  }
  function markAll(entries) {
    for (const record of entries.values()) mark(record);
  }
  function binding(node) {
    if (ts.isObjectBindingPattern(node)) {
      const entries = namespace(node);
      if (entries) for (const element of node.elements) {
        if (element.dotDotDotToken) markAll(entries);
        else {
          const property = element.propertyName ?? element.name;
          if (ts.isComputedPropertyName(property)) {
            const keys = finiteStrings(checker.getTypeAtLocation(property.expression));
            if (keys) for (const key of keys) mark(entries.get(key));
            else errors.push(`${node.getSourceFile().fileName}: namespace binding needs a finite key union`);
          } else mark(entries.get(property.getText().replaceAll('"', "").replaceAll("'", "")));
        }
      }
    }
    if (ts.isArrayBindingPattern(node)) for (const element of node.elements) if (ts.isBindingElement(element)) binding(element.name);
  }
  function declarationName(node) {
    const parent = node.parent;
    return (parent.name === node && (ts.isDeclarationStatement(parent) || ts.isVariableDeclaration(parent) ||
      ts.isBindingElement(parent) || ts.isParameter(parent) || ts.isPropertySignature(parent) || ts.isMethodSignature(parent))) ||
      ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent) || ts.isImportClause(parent) || ts.isNamespaceImport(parent);
  }
  function finiteStrings(type) {
    if (type.isStringLiteral()) return [type.value];
    if (!type.isUnion()) return null;
    const parts = type.types.map(finiteStrings);
    return parts.every(Boolean) ? parts.flat() : null;
  }
  function validateImport(specifier, source) {
    if (specifier && ts.isStringLiteralLike(specifier) && /^\.{1,2}\//.test(specifier.text) &&
      !/\.(?:css|scss|json)$/.test(specifier.text) && !moduleAt(specifier)) {
      errors.push(`${source.fileName}: unresolved local module ${JSON.stringify(specifier.text)}`);
    }
  }
  function visit(node, source) {
    if (ts.isExportDeclaration(node) || ts.isImportDeclaration(node)) { validateImport(node.moduleSpecifier, source); return; }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) validateImport(node.arguments[0], source);
    if (ts.isObjectBindingPattern(node) || ts.isArrayBindingPattern(node)) binding(node);
    if (ts.isPropertyAccessExpression(node)) mark(namespace(node.expression)?.get(node.name.text));
    if (ts.isQualifiedName(node)) mark(namespace(node.left)?.get(node.right.text));
    if (ts.isElementAccessExpression(node) && node.argumentExpression) {
      const entries = namespace(node.expression);
      if (entries) {
        const keys = finiteStrings(checker.getTypeAtLocation(node.argumentExpression));
        if (keys) for (const key of keys) mark(entries.get(key));
        else errors.push(`${source.fileName}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}: namespace index needs a finite key union`);
      }
    }
    if (ts.isIdentifier(node) && !declarationName(node)) {
      const symbol = checker.getSymbolAtLocation(node);
      if (symbol?.declarations?.some(declaration => declaration.getSourceFile() !== source)) markSymbol(symbol, source.fileName);
      // Imports retain their public facade as well as the originating symbol.
      if (symbol?.flags & ts.SymbolFlags.Alias) markSymbol(symbol, source.fileName);
    }
    if (ts.isIdentifier(node) || ts.isAwaitExpression(node)) {
      const entries = namespace(node);
      let expression = node, parent = node.parent;
      while (ts.isParenthesizedExpression(parent) || ts.isAsExpression(parent) || ts.isNonNullExpression(parent)) {
        expression = parent; parent = parent.parent;
      }
      if (entries && !declarationName(node) &&
        !(ts.isPropertyAccessExpression(parent) && parent.expression === expression) &&
        !(ts.isQualifiedName(parent) && parent.left === expression) &&
        !(ts.isElementAccessExpression(parent) && parent.expression === expression) &&
        !(ts.isVariableDeclaration(parent) && parent.initializer === expression) && !ts.isAwaitExpression(parent)) {
        markAll(entries); escaped.add(source.fileName);
      }
    }
    ts.forEachChild(node, child => visit(child, source));
  }
  for (const source of sources) visit(source, source);
  return {
    count: records.length, namespaceConsumers: [...escaped].sort(), errors,
    unused: records.filter(record => !record.used).map(({ file, name }) => ({ file, name }))
      .sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name)),
  };
}
