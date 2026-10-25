import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "@typescript/typescript6";
import { collectModules, createExportProgram } from "./exports/program.mjs";
import { analyzeExportUsage } from "./exports/usage.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const roots = ["src", "scripts", "tests"].map(directory => path.join(root, directory));
const { program, bridges } = createExportProgram(root, roots.flatMap(collectModules), {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowJs: true, noEmit: true, allowImportingTsExtensions: true, skipLibCheck: true,
});
const report = analyzeExportUsage(program, roots);
for (const { file, name } of report.unused) console.error(`Unused export: ${path.relative(root, file).replaceAll(path.sep, "/")}#${name}`);
for (const error of report.errors) console.error(error);
if (report.unused.length || report.errors.length) process.exitCode = 1;
else console.log(`Export usage passed: ${report.count} exports; ${bridges.length} test imports mapped to source; no unused exports.`);
