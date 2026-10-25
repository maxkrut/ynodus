import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createModuleLoader } from "./module-loader.mjs";
import { TEMP_ROOT } from "./runtime.mjs";

export async function assertModuleLoaderContracts() {
  const sourceRoot = path.join(TEMP_ROOT, "loader-fixtures", "src");
  const outputRoot = path.join(TEMP_ROOT, "loader-fixtures", "output");
  const files = {
    "entry.ts": `
      import "./side-effect";
      import type { Unused } from "./missing-type";
      import { value } from "./nested";
      import "node:path";
      export { cycleValue } from "./cycle-a.js";
      export { stubbed } from "./substitute.ts";
      export { virtual } from "./virtual";
      export const total: number = value + 1;
      export const sideEffect = globalThis.__ynodusLoaderSideEffect;
      export const lookalike = 'from "./not-an-import"';
      export async function later() { return (await import('./lazy')).lazy; }
    `,
    "side-effect.ts": "globalThis.__ynodusLoaderSideEffect = (globalThis.__ynodusLoaderSideEffect ?? 0) + 1;",
    "nested/index.ts": 'export { value } from "../leaf.js";',
    "leaf.ts": "export const value: number = 41;",
    "cycle-a.ts": 'import { valueB } from "./cycle-b"; export const cycleValue = () => valueB(); export const valueA = 3;',
    "cycle-b.ts": 'import { valueA } from "./cycle-a"; export const valueB = () => valueA + 1;',
    "lazy.ts": "export const lazy = 9;",
    // Loading the real replacement target or unrelated modules would fail the test.
    "substitute.ts": 'import "./missing-production-dependency"; throw new Error("Real module was loaded");',
    "unused.ts": 'throw new Error("Unrelated module was loaded");',
    "missing.ts": 'export * from "./not-found";',
    "computed.ts": 'export const later = (file: string) => import(file);',
    "outside.ts": 'import "../outside";',
    "broken.ts": 'export const broken = ;',
  };
  for (const [file, source] of Object.entries(files)) {
    const target = path.join(sourceRoot, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, source);
  }
  const { loadModule, stubModule } = createModuleLoader({ sourceRoot, outputRoot });
  stubModule("substitute.ts", 'export { value as stubbed } from "./leaf";');
  stubModule("virtual.ts", "export const virtual = 5;");
  try {
    const [entry, leaf] = await Promise.all([loadModule("entry.ts"), loadModule("leaf.ts")]);
    assert.equal(entry.total, 42, "Follow transitive imports and directory index re-exports");
    assert.equal(leaf.value, 41);
    assert.equal(entry.cycleValue(), 4, "Import cycles must terminate without losing dependencies");
    assert.equal(entry.stubbed, 41, "The test double replaces the real source and follows its own imports");
    assert.equal(entry.virtual, 5, "A test double needs no production source file");
    assert.equal(await entry.later(), 9, "Literal dynamic imports must be prepared before evaluation");
    assert.equal(entry.lookalike, 'from "./not-an-import"', "Import-like text must remain unchanged");
    assert.equal(entry.sideEffect, 1, "Side-effect imports must execute exactly once");
    assert.strictEqual(await loadModule("entry.ts"), entry, "Repeated loads share the native module cache");
    for (const file of ["unused.js", "missing-type.js"]) {
      await assert.rejects(fs.access(path.join(outputRoot, file)), { code: "ENOENT" });
    }
    assert.throws(() => stubModule("leaf.ts", ""), /before loading/, "Reject doubles registered after imports");
    await assert.rejects(loadModule("missing.ts"), /Cannot resolve.*not-found.*missing\.ts/);
    await assert.rejects(loadModule("computed.ts"), /Non-literal dynamic import.*computed\.ts/);
    await assert.rejects(loadModule("outside.ts"), /escapes source root/);
    await assert.rejects(loadModule("broken.ts"), /Expression expected/);
    assert.throws(() => loadModule("../outside.ts"), /escapes source root/);
    await fs.writeFile(path.join(sourceRoot, "new.ts"), "export const added = 7;");
    await fs.writeFile(path.join(sourceRoot, "new-entry.ts"), 'export { added } from "./new";');
    assert.equal((await loadModule("new-entry.ts")).added, 7,
      "New dependencies need no manifest edits; failed graphs must not block later loads");
  } finally {
    delete globalThis.__ynodusLoaderSideEffect;
  }
}
