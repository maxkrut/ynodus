import { expect, test } from "@playwright/test";
import { countryDeepFixture } from "../fixtures/layout.mjs";

for (const view of ["profile", "country"] as const) {
  test(`expanded ancestors use available width and keep natural wraps in ${view}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/data/hras-index.json", route => route.fulfill({ json: countryDeepFixture() }));
    const selector = view === "profile" ? ".ancestry-breadcrumb" : ".country-branch-path";
    const tokenSelector = view === "profile" ? "a" : "[data-country-evidence-anchor]";
    for (const language of ["ru", "en",]) {
      await page.setViewportSize({ width: 2560, height: 1000 });
      await page.goto(`/?lang=${language}&view=${view}&clade=R-SYN-DEPTH-15${view === "country" ? "&country=RUS" : ""}`);
      const path = page.locator(selector);
      const tokens = path.locator(tokenSelector);
      const summary = path.locator("summary");
      if (view === "country") {
        await expect(tokens.filter({ visible: true })).toHaveCount(4);
        await summary.focus();
        await page.keyboard.press("Enter");
        await expect(path.locator("details")).toHaveAttribute("open", "");
      } else await expect(path.locator("details")).toHaveCount(0);
      await expect(tokens.filter({ visible: true })).toHaveCount(16);
      const expandedIds = await tokens.allTextContents();
      expect(expandedIds).toEqual(Array.from({ length: 16 }, (_, i) => `R-SYN-DEPTH-${i}`));
      const tops = await tokens.evaluateAll(elements => elements.map(el => el.getBoundingClientRect().top));
      expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(1);
      if (language === "ru") await path.screenshot({ path: `output/text-flow/${view}-wide.png` });
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await expect(tokens.filter({ visible: true })).toHaveCount(16);
        expect(await tokens.allTextContents()).toEqual(expandedIds);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
        const pathBounds = await path.evaluate(el => ({ client: el.clientWidth, scroll: el.scrollWidth }));
        expect(pathBounds.scroll).toBeLessThanOrEqual(pathBounds.client + 1);
        if (width === 390 && language === "ru") await path.screenshot({ path: `output/text-flow/${view}-mobile.png` });
      }
      if (view === "country") {
        await summary.focus();
        await page.keyboard.press("Space");
        await expect(path.locator("details")).not.toHaveAttribute("open", "");
        await expect(tokens.filter({ visible: true })).toHaveCount(4);
        await expect(summary).toBeFocused();
      }
    }
    expect(errors).toEqual([]);
  });
}

