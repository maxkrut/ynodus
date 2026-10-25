import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "@typescript/typescript6";

export async function runtime(root, destination, mutation) {
  let replacements = 0;
  async function compile(relative) {
    const sourcePath = path.join(root, relative);
    for (const entry of await fs.readdir(sourcePath, { withFileTypes: true })) {
      const file = `${relative}/${entry.name}`;
      if (entry.isDirectory()) { await compile(file); continue; }
      if (!entry.name.endsWith(".ts")) continue;
      await compileFile(file);
    }
  }
  async function compileFile(file) {
    let source = await fs.readFile(path.join(root, file), "utf8");
    if (mutation?.file === file) {
      if (source.split(mutation.before).length !== 2) throw new Error(`Mutation must match exactly once: ${mutation.name}`);
      source = source.replace(mutation.before, mutation.after);
      replacements++;
    }
    const output = ts.transpileModule(source, { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
    } }).outputText.replace(/(from\s*["']|import\s*\(\s*["'])(\.{1,2}\/[^"']+)(["'])/g,
      (_, start, specifier, end) => `${start}${path.extname(specifier) ? specifier : `${specifier}.js`}${end}`);
    const target = path.join(destination, file.replace(/\.ts$/, ".js"));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, output);
  }
  for (const directory of ["src/shared", "src/worker"]) await compile(directory);
  for (const file of ["src/app/export-csv.ts", "src/app/format.ts", "src/app/constants.ts"]) await compileFile(file);
  if (mutation && replacements !== 1) throw new Error(`Unapplied mutation ${mutation.name}`);
  const load = (file) => import(pathToFileURL(path.join(destination, file)).href);
  return { ...await load("src/worker/index-builder.js"), ...await load("src/worker/slice-analysis.js"),
    ...await load("src/worker/evidence-profile.js"), ...await load("src/shared/time.js"),
    ...await load("src/app/export-csv.js") };
}

export async function removeTemporaryDirectory(root, directory) {
  const boundary = path.resolve(root, "tmp"), target = path.resolve(directory);
  const relative = path.relative(boundary, target);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("Audit cleanup target must be a child of the workspace tmp directory");
  }
  await fs.rm(target, { recursive: true, force: true });
}
