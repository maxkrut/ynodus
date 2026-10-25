import path from "node:path";
import ts from "@typescript/typescript6";

export function analyzeTranslationUsage(program, { dictionaryFile, sourceRoot, dictionaryRoot }) {
  const checker = program.getTypeChecker();
  const dictionary = program.getSourceFile(path.resolve(dictionaryFile));
  const declaration = dictionary?.statements.flatMap(statement => ts.isVariableStatement(statement)
    ? [...statement.declarationList.declarations] : []).find(node => node.name.getText(dictionary) === "en");
  if (!declaration) throw new Error(`English dictionary export not found: ${dictionaryFile}`);
  const keys = new Set(checker.getTypeAtLocation(declaration.name).getProperties().map(property => property.name));
  const used = new Set(), dynamic = new Set(), errors = [];
  const messageTypes = new Map();
  sourceRoot = path.resolve(sourceRoot);
  dictionaryRoot = path.resolve(dictionaryRoot);

  function isWithin(root, file) {
    const relative = path.relative(root, path.resolve(file));
    return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  }
  function location(node) {
    const source = node.getSourceFile(), position = source.getLineAndCharacterOfPosition(node.getStart());
    return `${path.relative(sourceRoot, source.fileName)}:${position.line + 1}`;
  }
  function reference(key, node, strict = false) {
    if (keys.has(key)) used.add(key);
    else if (strict) errors.push(`${location(node)}: unknown translation key ${JSON.stringify(key)}`);
  }
  function strings(type) {
    if (type.isStringLiteral()) return [type.value];
    if (!type.isUnion()) return null;
    const values = type.types.map(strings);
    return values.every(Boolean) ? values.flat() : null;
  }
  function isTextKey(type) {
    if (!type) return false;
    const parts = type.isUnion() ? type.types.filter(part => !(part.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined))) : [type];
    const values = parts.map(strings).every(Boolean) ? parts.flatMap(strings) : null;
    return values?.length > 0 && values.every(value => keys.has(value));
  }
  function dynamicKeys(node) {
    let values = [node.head.text];
    for (const span of node.templateSpans) {
      const alternatives = strings(checker.getTypeAtLocation(span.expression));
      if (!alternatives || values.length * alternatives.length > 4096) {
        errors.push(`${location(node)}: dynamic translation key needs a finite literal union`);
        return;
      }
      values = values.flatMap(prefix => alternatives.map(value => `${prefix}${value}${span.literal.text}`));
    }
    for (const key of values) { reference(key, node, true); dynamic.add(key); }
  }
  function messages(type) {
    if (!messageTypes.has(type)) {
      const properties = new Set(type.getProperties().map(property => property.name));
      messageTypes.set(type, [...keys].every(key => properties.has(key)));
    }
    return messageTypes.get(type);
  }
  function markup(text, node) {
    for (const match of text.matchAll(/\bdata-i18n(?:-[\w-]+)?\s*=\s*["']([^"'${}<>]+)["']/g)) {
      reference(match[1], node, true);
    }
  }
  function visit(node) {
    if (ts.isStringLiteralLike(node)) markup(node.text, node);
    if (ts.isStringLiteralLike(node) || ts.isIdentifier(node) || ts.isConditionalExpression(node) ||
      ts.isElementAccessExpression(node) || ts.isPropertyAccessExpression(node) || ts.isAsExpression(node)) {
      if (isTextKey(checker.getContextualType(node))) {
        const values = strings(checker.getTypeAtLocation(node));
        // Generic forwarding of TextKey is not evidence that every dictionary key is used.
        if (values && values.length < keys.size) for (const value of values) reference(value, node);
      }
    }
    if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) markup(node.text, node);
    if (ts.isPropertyAccessExpression(node) && keys.has(node.name.text) && messages(checker.getTypeAtLocation(node.expression))) {
      reference(node.name.text, node);
    }
    if (ts.isTemplateExpression(node) && (isTextKey(checker.getContextualType(node)) ||
      (ts.isAsExpression(node.parent) && isTextKey(checker.getTypeAtLocation(node.parent))))) dynamicKeys(node);
    ts.forEachChild(node, visit);
  }
  for (const source of program.getSourceFiles()) {
    if (!source.isDeclarationFile && isWithin(sourceRoot, source.fileName) && !isWithin(dictionaryRoot, source.fileName)) visit(source);
  }
  return { keys: [...keys].sort(), unused: [...keys].filter(key => !used.has(key)).sort(), dynamic: [...dynamic].sort(), errors };
}
