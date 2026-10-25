import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAX_LINES = 400;
const SOURCE_EXTENSIONS = new Set([".css", ".html", ".js", ".mjs", ".ts", ".tsx"]);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_ROOTS = ["src", "scripts", "tests"];
const ROOT_SOURCE_FILES = ["index.html", "playwright.config.ts", "vite.config.js"];

const sourceFiles = [
  ...SOURCE_ROOTS.flatMap((directory) => collectSourceFiles(path.join(ROOT, directory))),
  ...ROOT_SOURCE_FILES.map((file) => path.join(ROOT, file)).filter(fs.existsSync),
];
const oversized = sourceFiles
  .map((file) => ({ file, lines: lineCount(file) }))
  .filter(({ lines }) => lines > MAX_LINES)
  .sort((left, right) => right.lines - left.lines || left.file.localeCompare(right.file));

if (oversized.length > 0) {
  console.error(`Source-size contract failed: ${oversized.length} file(s) exceed ${MAX_LINES} lines.`);
  for (const { file, lines } of oversized) {
    console.error(`- ${path.relative(ROOT, file)}: ${lines} lines`);
  }
  process.exitCode = 1;
} else {
  console.log(`Source-size contract passed: ${sourceFiles.length} maintained files are at most ${MAX_LINES} lines.`);
}

function collectSourceFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(entryPath);
    return entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name)) ? [entryPath] : [];
  });
}

function lineCount(file) {
  const source = fs.readFileSync(file, "utf8");
  if (source.length === 0) return 0;
  return source.split(/\r?\n/).length - (source.endsWith("\n") ? 1 : 0);
}
