import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createModuleLoader } from "./module-loader.mjs";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const TEMP_ROOT = path.join(ROOT, "tmp", `.app-contracts-test-${process.pid}-${Date.now()}`);

export const { loadModule, stubModule } = createModuleLoader({
  sourceRoot: path.join(ROOT, "src"), outputRoot: TEMP_ROOT,
});

export function readCssEntry(file, stack = new Set()) {
  const absolute = path.resolve(file);
  if (stack.has(absolute)) throw new Error(`Circular CSS import: ${absolute}`);
  const nextStack = new Set(stack).add(absolute);
  const source = fs.readFileSync(absolute, "utf8");
  return source.replace(/@import\s+["']([^"']+)["'];?/g, (_match, specifier) =>
    readCssEntry(path.resolve(path.dirname(absolute), specifier), nextStack));
}
