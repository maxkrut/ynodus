import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "@typescript/typescript6";
import { analyzeTranslationUsage } from "./i18n/usage.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = ts.readConfigFile(path.join(root, "tsconfig.json"), ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
if (parsed.errors.length) throw new Error(parsed.errors.map(error => ts.flattenDiagnosticMessageText(error.messageText, "\n")).join("\n"));
const program = ts.createProgram(parsed.fileNames, parsed.options);
const report = analyzeTranslationUsage(program, {
  dictionaryFile: path.join(root, "src/app/i18n/en.ts"),
  dictionaryRoot: path.join(root, "src/app/i18n"), sourceRoot: path.join(root, "src"),
});
if (report.unused.length || report.errors.length) {
  for (const key of report.unused) console.error(`Unused translation key: ${key}`);
  for (const error of report.errors) console.error(error);
  process.exitCode = 1;
} else {
  console.log(`Translation usage passed: ${report.keys.length} keys, including ${report.dynamic.length} computed labels; no unused keys.`);
}
