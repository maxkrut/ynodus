import { expect, test } from "@playwright/test";
import { countryDeepFixture, layoutFixture } from "../fixtures/layout.mjs";

function fixture() {
  const data = countryDeepFixture();
  data.nodeIds.push("R-SYN-DESCENDANT");
  data.nodes.push([0, 15, 6000]);
  data.countryCodes = layoutFixture().countryCodes;
  data.samples = data.countryCodes.map((_, i) => [16, i, i + 1]);
  data.countryCounts = data.countryCodes.map((_, i) => i + 1);
  data.hrasManifestSampleCount = data.countryCounts.reduce((a, b) => a + b, 0);
  return data;
}

for (const width of [390, 768, 1051, 1280, 1440, 2560]) test(`summary precedes the full-width tree at ${width}`, async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/data/hras-index.json", route => route.fulfill({ json: fixture() }));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/?lang=ru&view=profile&clade=R-SYN-DEPTH-15&countries=RUS&min=0");
    const root = page.locator("#profile-content");
    await expect(root.locator(".country-evidence-row")).toHaveCount(12);
    await expect(root.locator('[data-profile-countries]')).not.toHaveAttribute('open');
    await expect(root.locator('.result-country-preview .flag')).toHaveCount(3);
    await expect(root.locator('.result-country-preview')).toContainText('+9');
    await expect(root.locator('.profile-compact-path')).toContainText('R-SYN-DEPTH-15');
    await root.locator('[data-profile-inspector-disclosure] > summary').click();
    for (const language of ["ru", "en",]) {
      await page.locator("#locale-switcher").selectOption(language);
      const disclosure = root.locator('[data-profile-countries]');
      if (!await disclosure.evaluate(node => (node as HTMLDetailsElement).open)) await disclosure.locator('summary').click();
      const geometry = await page.evaluate(() => {
        const rect = (s: string) => document.querySelector(s)!.getBoundingClientRect();
        const tree = rect(".profile-tree-section"), summary = rect("[data-profile-inspector]"), content = rect("#profile-content");
        const countryList = document.querySelector<HTMLElement>('[data-evidence-list="profile-countries"]')!;
        return { tree: tree.toJSON(), summary: summary.toJSON(), content: content.toJSON(),
          overflow: document.documentElement.scrollWidth - innerWidth,
          listHeight: countryList.clientHeight, listContent: countryList.scrollHeight };
      });
      expect(geometry.overflow).toBe(0);
      expect(Math.abs(geometry.tree.width - geometry.content.width)).toBeLessThanOrEqual(1);
      expect(geometry.summary.bottom).toBeLessThan(geometry.tree.top);
      if (width >= 1051) expect(geometry.listHeight).toBeLessThan(geometry.listContent);
      else expect(geometry.listHeight).toBeGreaterThanOrEqual(geometry.listContent);
      await root.locator('[data-profile-select="R-SYN-DESCENDANT"]').click();
      await expect(root.locator(".profile-selected-summary h3")).toHaveText("R-SYN-DESCENDANT");
      await expect(root.locator(".profile-selected-metric strong")).toHaveText("78");
      await expect(root.locator(".profile-selected-direct")).toContainText("78");
      await expect(root.locator(".profile-selected-age")).toContainText("6");
      await root.locator('[data-profile-select="R-SYN-DEPTH-15"]').click();

      await expect(root.locator("[data-profile-inspector]")).toBeVisible();
      await expect(root.locator(".profile-matrix")).toBeVisible();

      await expect(root.locator("[data-profile-inspector]")).toBeVisible();
    }
  expect(errors).toEqual([]);
});

test("country summary keeps its scroll position through a drill-down, comparison and reload", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route("**/data/hras-index.json", route => route.fulfill({ json: fixture() }));
  await page.goto("/?lang=ru&view=profile&clade=R-SYN-DEPTH-15&countries=RUS&min=0");
  const list = page.locator('[data-evidence-list="profile-countries"]');
  await expect(list.locator(".country-evidence-row")).toHaveCount(12);
  await page.locator('[data-profile-inspector-disclosure] > summary').click();
  await page.locator('[data-profile-countries] > summary').click();
  await list.evaluate(el => { el.scrollTop = el.scrollHeight; });
  const top = await list.evaluate(el => el.scrollTop);
  expect(top).toBeGreaterThan(0);
  await list.locator('[data-country-evidence="RUS"]').click();
  await expect(page.locator("#country-evidence-workspace")).toBeVisible();
  await page.locator("#country-evidence-workspace [data-research-back]").click();
  await expect(page.locator("#profile-workspace")).toBeVisible();
  await expect.poll(() => list.evaluate(el => el.scrollTop)).toBe(top);


  await expect.poll(() => list.evaluate(el => el.scrollTop)).toBe(top);
  await page.reload();
  await expect(page.locator('[data-profile-countries]')).toHaveAttribute('open');
  await expect.poll(() => list.evaluate(el => el.scrollTop)).toBe(top);
});

test("revealing the last country retains visible keyboard focus in the compact summary", async ({ page }) => {
  const data = fixture();
  data.countryCodes.push("USA");
  data.countryCounts.push(13);
  data.samples.push([16, 12, 13]);
  data.hrasManifestSampleCount += 13;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route("**/data/hras-index.json", route => route.fulfill({ json: data }));
  await page.goto("/?lang=ru&view=profile&clade=R-SYN-DEPTH-15&countries=RUS&min=0");
  const list = page.locator('[data-evidence-list="profile-countries"]');
  const more = page.locator('[data-reveal-evidence="profile-countries"]');
  await page.locator('[data-profile-inspector-disclosure] > summary').click();
  await page.locator('[data-profile-countries] > summary').click();
  await expect(more).toBeVisible();
  await list.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await more.focus();
  await page.keyboard.press("Enter");
  await expect(more).toHaveCount(0);
  const last = list.locator('[data-country-evidence="RUS"]');
  await expect(last).toBeFocused();
  await expect(last).toBeInViewport();
  expect(await last.evaluate(el => {
    const row = el.getBoundingClientRect(), viewport = el.closest('[data-evidence-list]')!.getBoundingClientRect();
    return row.top >= viewport.top - 1 && row.bottom <= viewport.bottom + 1;
  })).toBe(true);
});
