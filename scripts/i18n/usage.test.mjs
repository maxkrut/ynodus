import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import ts from "@typescript/typescript6";
import { analyzeTranslationUsage } from "./usage.mjs";

async function fixture(extra, check) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ynodus-i18n-"));
  try {
    const files = {
      "src/i18n/fragment.ts": 'export const fragment = { fromFragment: "Fragment", definitionOnly: "Definition" } as const;',
      "src/i18n/en.ts": `import { fragment } from './fragment';
        export const en = { ...fragment, direct: 'Direct', access: 'Access', attribute: 'Attribute',
          periodOne: 'Period', periodOneShort: 'P', one: 'One', two: 'Two', deferred: 'Loading',
          orphan: 'Unused', testOnly: 'Test', commentOnly: 'Comment', valueOnly: 'Value' } as const;
        export type TextKey = keyof typeof en;`,
      "src/entry.ts": `import { en, type TextKey } from './i18n/en';
        const t = (key: TextKey) => en[key];
        t('direct'); t('fromFragment'); en.access;
        const unit: 'one' | 'two' = Math.random() ? 'one' : 'two'; t(unit);
        let message: TextKey | null = null; message = 'deferred'; t(message);
        const html = '<span data-i18n="attribute"></span>';
        const periods = [{ label: 'periodOne' }] as const;
        t(periods[0].label);
        periods.forEach(period => t(\`\${period.label}Short\` as TextKey));
        // t('commentOnly');
        const unrelatedValue = 'valueOnly';
      `,
      "tests/entry.test.ts": "const fixture = 'testOnly';",
      ...extra,
    };
    for (const [file, source] of Object.entries(files)) {
      const target = path.join(root, file);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, source);
    }
    const program = ts.createProgram(Object.keys(files).map(file => path.join(root, file)), {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    });
    await check(analyzeTranslationUsage(program, {
      dictionaryFile: path.join(root, "src/i18n/en.ts"), dictionaryRoot: path.join(root, "src/i18n"),
      sourceRoot: path.join(root, "src"),
    }));
  } finally { await fs.rm(root, { recursive: true, force: true }); }
}

test("find unused merged keys without counting dictionaries, comments or tests as usage", async () => {
  await fixture({}, report => {
    assert.deepEqual(report.unused, ["commentOnly", "definitionOnly", "orphan", "testOnly", "valueOnly"]);
    assert.deepEqual(report.dynamic, ["periodOneShort"]);
    assert.deepEqual(report.errors, []);
  });
});

test("catch a newly added unused key without changing the checker", async () => {
  await fixture({ "src/i18n/fragment.ts": 'export const fragment = { fromFragment: "F", addedDeadKey: "D" } as const;' }, report => {
    assert.ok(report.unused.includes("addedDeadKey"));
  });
});

test("fail for an unknown static HTML key and a missing computed label", async () => {
  await fixture({ "src/extra.ts": `import type { TextKey } from './i18n/en';
    const html = '<b data-i18n-aria-label="unknownLabel"></b>';
    const period = 'periodTwo' as const;
    const key = \`\${period}Short\` as TextKey;` }, report => {
    assert.equal(report.errors.length, 2);
    assert.ok(report.errors.some(error => error.includes('"unknownLabel"')));
    assert.ok(report.errors.some(error => error.includes('"periodTwoShort"')));
  });
});

test("fail closed for an unbounded computed translation key", async () => {
  await fixture({ "src/extra.ts": `import type { TextKey } from './i18n/en';
    export const key = (label: string) => \`\${label}Short\` as TextKey;` }, report => {
    assert.ok(report.errors.some(error => error.includes("finite literal union")));
  });
});
