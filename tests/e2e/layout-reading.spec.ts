import { checkSourceExplanations, openStandaloneProfile } from "./production-smoke-support";
import { expect, test } from "@playwright/test";
import { layoutFixture, layoutQuery } from "../fixtures/layout.mjs";

test("source facts, query controls and result actions keep readable axes", async ({ page }) => {
  await page.route("**/data/hras-index.json", route => route.fulfill({ json: layoutFixture() }));
  await page.goto(layoutQuery);
  await expect(page.locator('#result-body tr[data-result-role="formed"]')).toHaveCount(15);
  for (const width of [320, 390, 760, 761, 1050, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const locale of ["ru", "en",]) {
      await page.locator("#locale-switcher").selectOption(locale);
      await expect(page.locator(".provenance-version")).toHaveCount(3);
      await expect(page.locator('.app-header [data-annotation="source-sync"]')).toBeVisible();
      await expect(page.locator(".provenance-links").first()).toBeVisible();
      const geometry = await page.evaluate(() => {
        const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
        const rects = [...document.querySelectorAll(".provenance-row")].map(row =>
          [".provenance-entity", ".provenance-version", ".provenance-date"].map(selector => row.querySelector(selector)!.getBoundingClientRect().left));
        const controlTops = ["#selection-panel-toggle", ".mockup-target-date-control", ".delta-stepper", "#min-result-samples", "#presence-mode-toggle", ".query-binary-switch"].map(selector => box(selector).top);
        const actionBottoms = ["#result-macrogroup-filter", "#export-csv"].map(selector => box(selector).bottom);
        const query = box(".query-zone");
        const heading = box("#result-title"), badge = box('.formed-result-set [data-annotation="formed"]'), counter = box("#result-count");
        const controls = [...document.querySelectorAll<HTMLElement>(".query-zone button, .query-zone input")].filter(el => el.getBoundingClientRect().width > 0);
        return {
          overflow: document.documentElement.scrollWidth - innerWidth,
          zoom: getComputedStyle(document.documentElement).zoom,
          sourceDrift: Math.max(...[0, 1, 2].map(i => Math.max(...rects.map(r => r[i])) - Math.min(...rects.map(r => r[i])))),
          controlDrift: Math.max(...controlTops) - Math.min(...controlTops),
          actionDrift: Math.max(...actionBottoms) - Math.min(...actionBottoms),
          controlOverflow: controls.some(el => { const r = el.getBoundingClientRect(); return r.left < query.left || r.right > query.right; }),
          headerHeight: box(".app-header").height,
          resultsTop: box("#results").top,
          resultGap: box("#results").top-box(".timeline-zone").bottom,
          timelineTop: box(".timeline-zone").top,
          rowFont: parseFloat(getComputedStyle(document.querySelector("#result-body td:not(.mockup-row-number)")!).fontSize),
          headingBadgeGap: badge.left - heading.right,
          counterWidth: counter.width,
          counterTop: counter.top, headingTop: heading.top, headingBottom: heading.bottom,
        };
      });
      const label = `${width}px ${locale}`;
      expect(geometry.overflow, label).toBeLessThanOrEqual(0);
      expect(Number(geometry.zoom), label).toBeCloseTo(width >= 1280 ? .64 : .8, 2);
      expect(geometry.sourceDrift, label).toBeLessThanOrEqual(1);
      expect(geometry.controlOverflow, label).toBe(false);
      expect(geometry.rowFont, label).toBeGreaterThanOrEqual(12);
      expect(geometry.headingBadgeGap, label).toBeLessThanOrEqual(4);
      expect(geometry.headingBadgeGap, label).toBeGreaterThanOrEqual(0);
      if (width <= 760) {
        expect(geometry.counterWidth, label).toBeLessThan(50);
        expect(geometry.counterTop, label).toBeGreaterThanOrEqual(geometry.headingTop - 1);
        expect(geometry.counterTop, label).toBeLessThan(geometry.headingBottom);
      }
      if (width >= 1280) expect(geometry.controlDrift, label).toBeLessThanOrEqual(1);
      if (width <= 760) expect(geometry.actionDrift, label).toBeLessThanOrEqual(1);
      if (width === 390) expect(geometry.headerHeight, label).toBeLessThan(340);
      if (width >= 761 && width <= 1050) {
        expect(geometry.headerHeight, label).toBeLessThan(270);
        expect(geometry.resultGap, label).toBeLessThanOrEqual(24);
        expect(geometry.resultsTop, label).toBeGreaterThan(geometry.timelineTop);
      }
    }
  }
});

test("mobile result jump reaches rows without changing the committed query", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/data/hras-index.json", route => route.fulfill({ json: layoutFixture() }));
  await page.goto(layoutQuery + "&crossing=1");
  await expect(page.locator('#result-body tr[data-result-role="formed"]')).toHaveCount(15);
  const jump = page.locator("#query-results-jump");
  await expect(jump).toBeEnabled();
  const jumpBox = (await jump.boundingBox())!;
  expect(jumpBox.y + jumpBox.height).toBeLessThan(844);
  const original = page.url();
  await jump.click();
  await expect(page.locator("#result-title")).toBeFocused();
  const firstRow = (await page.locator('#result-body tr[data-result-role="formed"]').first().boundingBox())!;
  expect(firstRow.y).toBeGreaterThanOrEqual(0);
  expect(firstRow.y + firstRow.height).toBeLessThan(844);
  expect(page.url()).toBe(original);
  const widths = await page.locator('#crossing-result-body .crossing-endpoint .subclade-link').evaluateAll(links => links.map(link => {
    const range = document.createRange(); range.selectNodeContents(link);
    return range.getClientRects().length;
  }));
  expect(widths).toEqual([1, 1, 1, 1, 1, 1]);
});

test("mobile country presets disclose on demand and preserve selection through locale changes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/data/hras-index.json", route => route.fulfill({ json: layoutFixture() }));
  await page.goto(layoutQuery);
  await expect(page.locator('#result-body tr[data-result-role="formed"]')).toHaveCount(15);
  await page.locator("#selection-panel-toggle").click();
  const toggle = page.locator("[data-toggle-presets]");
  const presets = page.locator(".preset-browser");
  await expect(toggle).toBeVisible();
  await expect(presets).toBeHidden();
  const collapsedHeight = (await page.locator("#country-list").boundingBox())!.height;
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(presets).toBeVisible();
  expect((await page.locator("#country-list").boundingBox())!.height).toBeLessThan(collapsedHeight - 80);
  await page.keyboard.press("Escape");
  await page.locator("#locale-switcher").selectOption("en");
  await page.locator("#selection-panel-toggle").click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(presets).toBeVisible();
  await expect(page.locator('#country-list input[data-country-code]:checked')).toHaveCount(6);
  await toggle.click();
  await expect(presets).toBeHidden();
  expect((await page.locator("#country-list").boundingBox())!.height).toBeGreaterThan(collapsedHeight - 20);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(toggle).toBeHidden();
  await expect(presets).toBeVisible();
});

test("compact profile summary and full-width hierarchy stay aligned after translation", async ({page})=>{
 await page.route("**/data/hras-index.json",route=>route.fulfill({json:layoutFixture()}));await page.goto(layoutQuery);await openStandaloneProfile(page,"R-SYN-100");
 for(const width of [390,1050,1440]){await page.setViewportSize({width,height:900});for(const locale of ["ru","en"]){
  await page.locator("#locale-switcher").selectOption(locale);
  await expect(page.locator("[data-profile-scope-total]")).toHaveCount(1);
  const geometry=await page.evaluate(()=>{const header=document.querySelector(".profile-compact-header")!.getBoundingClientRect(),tree=document.querySelector(".profile-tree-section")!.getBoundingClientRect();return {overflow:document.documentElement.scrollWidth-innerWidth,left:Math.abs(header.left-tree.left),right:Math.abs(header.right-tree.right),gap:tree.top-header.bottom};});
  expect(geometry.overflow).toBeLessThanOrEqual(0);expect(geometry.left).toBeLessThanOrEqual(1);expect(geometry.right).toBeLessThanOrEqual(1);expect(geometry.gap).toBeGreaterThanOrEqual(0);
 }}
 await page.locator('#profile-content [data-tree-node="R-SYN-100"] [data-country-evidence="RUS"]').click();await expect(page.locator("#country-evidence-content [data-branch-scope-selected]")).toHaveCount(1);
});

test("calendar boundary and endpoint captions remain separated in every locale", async ({ page }) => {
  await page.route("**/data/hras-index.json", route => route.fulfill({ json: layoutFixture() }));
  await page.goto(layoutQuery);
  await expect(page.locator('#result-body tr[data-result-role="formed"]')).toHaveCount(15);
  for (const width of [1051, 1280, 1366, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const locale of ["ru", "en",]) {
      await page.locator("#locale-switcher").selectOption(locale);
      const gap = await page.evaluate(() => {
        const boundary = document.querySelector(".time-axis-labels .axis-zero")!.getBoundingClientRect();
        const endpoint = document.querySelector(".time-axis-labels .axis-ce")!.getBoundingClientRect();
        return endpoint.left - boundary.right;
      });
      expect(gap, `${width}px ${locale} calendar captions`).toBeGreaterThanOrEqual(8);
    }
  }
});

for (const outcome of ["loaded", "failed"] as const) {
  test(`visible source notes survive language changes and ${outcome} metadata`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/data/hras-index.json", async route => {
      await gate;
      if (outcome === "loaded") await route.fulfill({ json: layoutFixture() });
      else await route.fulfill({ status: 503, body: "Synthetic unavailable dataset" });
    });
    await page.goto(layoutQuery);
    const notes = page.locator("#provenance-notes");
    await checkSourceExplanations(page);
    await expect(page.locator(".provenance-details")).toHaveCount(0);
    await expect(page.locator(".provenance-version").first()).toHaveText(/^\s*-\s*!\s*$/);
    await expect(page.locator(".provenance-date time").first()).toBeVisible();
    const firstReference = page.locator('.provenance-row .provenance-links a').first();
    await firstReference.focus();
    await expect(firstReference).toBeFocused();
    await page.locator("#locale-switcher").selectOption("en");
    await checkSourceExplanations(page);
    await expect(notes).toBeHidden();
    release();
    if (outcome === "loaded") await expect(page.locator(".provenance-version").first()).toHaveText(/^synthetic\s*!$/);
    else await expect(page.locator("[data-retry-load]")).toBeVisible();
    await checkSourceExplanations(page);
    await expect(page.locator('.app-header [data-annotation="source-sync"]')).toBeVisible();
    for (const width of [320, 390, 1050, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      const badLinks = await page.locator(".provenance-links a").evaluateAll(links => links.filter(el => {
        const box = el.getBoundingClientRect();
        return box.width < 24 || box.height < 24 || box.left < 0 || box.right > innerWidth;
      }).map(el => el.textContent));
      expect(badLinks).toEqual([]);
    }
    await expect(page.locator(".provenance-links").first()).toBeVisible();
    await expect(page.locator(".provenance-version").first()).toBeVisible();
  });
}
