import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import ts from "@typescript/typescript6";
import { createExportProgram } from "./program.mjs";
import { analyzeExportUsage } from "./usage.mjs";

function fixture(files, check) {
  const root = path.resolve("tmp", "synthetic-export-project");
  const virtual = new Map(Object.entries(files).map(([file, source]) => [path.join(root, file), source]));
  const { program, bridges } = createExportProgram(root, [...virtual.keys()], {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    allowJs: true, noEmit: true, allowImportingTsExtensions: true,
  }, virtual);
  const report = analyzeExportUsage(program, [root]);
  const unused = report.unused.map(({ file, name }) => `${path.relative(root, file).replaceAll(path.sep, "/")}#${name}`);
  check({ ...report, unused, bridges });
}

test("named/default/type imports and aliases count; local calls and comments do not justify exports", () => {
  fixture({
    "src/model.ts": `export type Input = { value: number }; export function used() { return 1; }
      export function local() { return 2; } local();
      export const unused = 0; export default () => 3;`,
    "src/main.ts": `import run, { used as alias, type Input } from './model';
      const value: Input = { value: alias() }; run();
      // model.unused is not a reference`,
  }, report => {
    assert.deepEqual(report.unused, ["src/model.ts#local", "src/model.ts#unused"]);
    assert.deepEqual(report.errors, []);
  });
});

test("re-export chains and stars retain only consumed public names, including local aliases", () => {
  fixture({
    "src/base.ts": "export const used = 1; export const dead = 2;",
    "src/bridge.ts": "export { used as renamed } from './base'; export * from './base';",
    "src/barrel.ts": "export { renamed as live } from './bridge'; export { dead } from './bridge';",
    "src/local.ts": "export const internal = 1; export { internal as publicName }; export default internal;",
    "src/main.ts": "import {live} from './barrel'; import run, {publicName} from './local'; console.log(live, run, publicName);",
  }, report => {
    assert.deepEqual(report.unused, ["src/barrel.ts#dead", "src/base.ts#dead", "src/bridge.ts#dead", "src/bridge.ts#used", "src/local.ts#internal"]);
  });
});

test("namespace property and finite-index access preserve selected names, not every export", () => {
  fixture({
    "src/model.ts": "export const used = 1; export const indexed = 2; export const dead = 3;",
    "src/main.ts": "import * as model from './model'; console.log(model.used); const key = 'indexed' as const; model[key];",
  }, report => {
    assert.deepEqual(report.unused, ["src/model.ts#dead"]);
    assert.deepEqual(report.errors, []);
  });
});

test("whole-namespace consumers retain the observable API and unbounded indexes fail closed", () => {
  fixture({
    "src/model.ts": "export const a = 1; export const b = 2;",
    "src/main.ts": "import * as model from './model'; Object.keys(model); const key: string = 'a'; console.log(model[key]);",
  }, report => {
    assert.deepEqual(report.unused, []);
    assert.equal(report.errors.length, 1);
    assert.match(report.errors[0], /finite key union/);
    assert.equal(report.namespaceConsumers.length, 1);
  });
});

test("MJS loadModule namespaces, aliases, Promise.all and inline access map to TS test helpers", () => {
  fixture({
    "scripts/app-contracts/runtime.mjs": "export async function loadModule(file) { return {}; }",
    "src/model.ts": "export const helper = 1; export const inline = 2; export const dead = 3;",
    "src/other.ts": "export const other = 4; export const spare = 5;",
    "tests/contracts.mjs": `import { loadModule as load } from '../scripts/app-contracts/runtime.mjs';
      const [{ helper }, other] = await Promise.all([load('model.ts'), load('other.ts')]);
      console.log(helper, other.other, (await load('model.ts')).inline);`,
  }, report => {
    assert.deepEqual(report.unused, ["src/model.ts#dead", "src/other.ts#spare"]);
    assert.equal(report.bridges.length, 3);
  });
});

test("temporary Node URL imports and local wrappers resolve the compiled JS name to TS", () => {
  fixture({
    "src/model.ts": "export const helper = 1; export const dead = 2;",
    "tests/contracts.mjs": `import path from 'node:path'; import {pathToFileURL} from 'node:url';
      const TEMP_ROOT = 'synthetic-output';
      const {helper} = await import(pathToFileURL(path.join(TEMP_ROOT, 'model.js')).href);
      const load = file => import(pathToFileURL(path.join(TEMP_ROOT, file)).href);
      console.log(helper, (await load('src/model.js')).helper);`,
  }, report => {
    assert.deepEqual(report.unused, ["src/model.ts#dead"]);
    assert.equal(report.bridges.length, 2);
  });
});

test("an unused forwarding cycle is reported and side-effect imports do not consume named exports", () => {
  fixture({
    "src/a.ts": "export * from './b'; export const unused = 1;",
    "src/b.ts": "export * from './a';",
    "src/main.ts": "import './a';",
  }, report => assert.deepEqual(report.unused, ["src/a.ts#unused", "src/b.ts#unused"]));
});

test("a newly added unused export is caught without a manifest or whitelist edit", () => {
  fixture({
    "src/model.ts": "export const used = 1; export function newDeadExport() {}",
    "src/main.ts": "import {used} from './model'; console.log(used);",
  }, report => assert.deepEqual(report.unused, ["src/model.ts#newDeadExport"]));
});

test("literal dynamic imports, then callbacks and namespace re-exports preserve selected names", () => {
  fixture({
    "src/model.ts": "export const used = 1; export const dead = 2;",
    "src/facade.ts": "export * as api from './model';",
    "src/main.ts": "import {api} from './facade'; console.log(api.used, 'dead'); import('./model').then(module => module.used);",
  }, report => {
    assert.deepEqual(report.unused, ["src/model.ts#dead"]);
    assert.deepEqual(report.errors, []);
  });
});

test("unresolved local imports and nonliteral test-loader paths cannot silently pass", () => {
  fixture({ "src/main.ts": "import {missing} from './absent'; console.log(missing);" }, report => {
    assert.equal(report.errors.length, 1);
    assert.match(report.errors[0], /unresolved local module/);
  });
  assert.throws(() => fixture({
    "scripts/app-contracts/runtime.mjs": "export const loadModule = file => ({});",
    "tests/contracts.mjs": "import {loadModule} from '../scripts/app-contracts/runtime.mjs'; const file = 'model.ts'; loadModule(file);",
  }, () => {}), /literal module path/);
});

test("type namespace qualification and computed destructuring retain only referenced exports", () => {
  fixture({
    "src/model.ts": "export type Input = { value: number }; export type DeadType = string; export const used = 1; export const dead = 2;",
    "src/main.ts": `import type * as Types from './model'; import * as model from './model';
      const input: Types.Input = {value: 1}; const key = 'used' as const;
      const {[key]: alias} = model; console.log(input, alias);`,
  }, report => {
    assert.deepEqual(report.unused, ["src/model.ts#dead", "src/model.ts#DeadType"]);
    assert.deepEqual(report.errors, []);
  });
});
