import { expect, test } from "@playwright/test";
import { expectReadableText, measureTextStates, readTextContrast } from "./contrast-support";

const fixture = {
  format: "ynodus/hras-index-v3", formatVersion: 3,
  source: "Synthetic contrast fixture", sourceUrl: "https://example.test/",
  sourceManifestUrl: "https://example.test/manifest", licenseNotice: "Synthetic, no personal records",
  sourceLicenses: { applicationCode: "Apache-2.0", referenceTree: "Synthetic", hrasSourceCode: "Apache-2.0" },
  treeVersion: "contrast-1", treeOfficialVersion: "contrast-2", computedDate: "2026-01-01", generatedAt: "2026-01-02",
  hrasManifestSampleCount: 7, projectIds: ["R1a"], countryCodes: ["RUS"], countryCounts: [7],
  nodeIds: ["R-CONTRAST-ROOT", "R-CONTRAST-CHILD"], nodes: [[0, -1, 7000], [0, 0, 5450]],
  samples: [[0, 0, 2], [1, 0, 5]],
};

test("representative app controls retain text contrast in default, hover and keyboard focus", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route("**/data/hras-index.json", (route) => route.fulfill({ json: fixture }));
  // The minimum field participates only in Common branches and must be enabled
  // to measure its default, hover and keyboard-focus states.
  await page.goto("/?lang=en&countries=RUS&presence=all");
  await expect(page.locator("#result-body tr[data-result-role]")).toHaveCount(1);
  await expect(page.locator("#export-csv")).toBeEnabled();
  const sample = (name: string, control: string, text = control) => ({ name,
    control: page.locator(control), text: page.locator(text) });
  const readings = await measureTextStates(page, [
    sample("active workspace", '.research-entrypoints [data-research-view="time"]', '.research-entrypoints [data-research-view="time"] span'),
    sample("inactive workspace", '.research-entrypoints [data-research-view="profile"]', '.research-entrypoints [data-research-view="profile"] span'),
    sample("language value", "#locale-switcher"),
    sample("country scope", "#selection-panel-toggle", "#query-chip-countries"),
    sample("target year", "#target-year"),
    sample("BCE label", "#target-era", '#target-era [data-i18n="eraBceShort"]'),
    sample("CE label", "#target-era", '#target-era [data-i18n="eraCeShort"]'),
    sample("hit tolerance", "#max-delta-ybp"),
    sample("minimum samples", "#min-result-samples"),
    sample("result annotation", '.formed-result-set [data-annotation="formed"]', '.formed-result-set [data-annotation="formed"] > span'),
    sample("CSV export", "#export-csv", "#export-csv span"),
  ]);
  await page.locator('.research-entrypoints [data-research-view="profile"]').click();
  await page.locator("#profile-clade-search").fill("R-CONTRAST-CHILD");
  readings.push(...await measureTextStates(page, [
    sample("profile query", "#profile-clade-search"),
    sample("primary profile action", '#profile-lookup button[type="submit"]'),
  ]));
  await page.locator("#profile-clade-search").fill("R-CONTRAST-ROOT");
  await page.locator('#profile-lookup button[type="submit"]').click();
  await page.locator('#profile-content .tree-sheet [data-tree-node="R-CONTRAST-ROOT"] [data-country-evidence="RUS"]').click();
  await expect(page.locator('[data-branch-tree-node="R-CONTRAST-ROOT"]')).toBeVisible();
  await page.locator('.branch-country-filter-drawer > summary').click();
  readings.push(...await measureTextStates(page, [
    sample("all-country profile", '.country-all-profile'),
    sample("branch country selector", '#branch-country-selector'),
    sample("branch expand action", '[data-evidence-tree-toggle="R-CONTRAST-ROOT"]'),
  ]));
  // Keep exact observations available even if a threshold assertion fails.
  await testInfo.attach("text-contrast-states", { body: JSON.stringify(readings, null, 2), contentType: "application/json" });
  expectReadableText(readings);
});

test("contrast gate rejects broken hover and keyboard-focus colors", async ({ page }) => {
  await page.setContent(`<!doctype html><style>
    html { background: white; } button, summary { color: black; background: white; font: 14px sans-serif; }
    #bad:hover, #bad:focus-visible, #bad-summary:hover, #bad-summary:focus-visible { color: #eee; }
  </style><button id="good">Synthetic good</button><button id="bad">Synthetic bad</button>
    <details><summary id="good-summary">Synthetic disclosure</summary></details>
    <details><summary id="bad-summary">Synthetic broken disclosure</summary></details>`);
  expectReadableText(await measureTextStates(page, [{ name: "good", control: page.locator("#good") }]));
  const bad = await measureTextStates(page, [{ name: "bad", control: page.locator("#bad") }]);
  expect(bad.filter((reading) => reading.ratio < reading.minimum).map((reading) => reading.state))
    .toEqual(["hover", "focus"]);
  expect(() => expectReadableText(bad)).toThrow(/bad \/ hover/);
  expectReadableText(await measureTextStates(page, [{ name: "good summary", control: page.locator("#good-summary") }]));
  const badSummary = await measureTextStates(page, [{ name: "bad summary", control: page.locator("#bad-summary") }]);
  expect(badSummary.filter(reading => reading.ratio < reading.minimum).map(reading => reading.state)).toEqual(["hover", "focus"]);
  expect(() => expectReadableText(badSummary)).toThrow(/bad summary/);
});

test("contrast measurement composites transparent surfaces and rejects unmeasurable scopes", async ({ page }) => {
  await page.setContent(`<!doctype html><style>html { background: white; } button { font: 14px sans-serif; }
    #alpha { color: rgba(0,0,0,.5); background: rgba(0,0,0,.5); }
    #nested { color: black; background: white; } #nested span { color: #eee; }
    #gradient { color: black; background: linear-gradient(white, black); }
  </style><button id="alpha">Synthetic alpha</button>
  <button id="nested"><span>Synthetic child</span></button>
  <button id="gradient">Synthetic gradient</button><button id="disabled" disabled>Disabled</button>`);
  const alpha = await readTextContrast(page.locator("#alpha"));
  expect(alpha.background).toEqual([127.5, 127.5, 127.5]);
  expect(alpha.ratio).toBeCloseTo(2.62, 2);
  const nested = await measureTextStates(page, [{ name: "nested", control: page.locator("#nested"), text: page.locator("#nested span") }]);
  expect(() => expectReadableText(nested)).toThrow(/nested/);
  await expect(readTextContrast(page.locator("#nested"))).rejects.toThrow(/direct text/);
  await expect(readTextContrast(page.locator("#gradient"))).rejects.toThrow(/background image/);
  await expect(readTextContrast(page.locator("#disabled"))).rejects.toThrow(/disabled/);
  await expect(measureTextStates(page, [])).rejects.toThrow(/at least one/);
});
