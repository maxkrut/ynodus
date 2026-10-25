import { populatedTimeUrl } from "../fixtures/time-url";
import { expect, test } from "@playwright/test";

test("source columns and result transition remain readable across locales and widths", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(populatedTimeUrl);
  await expect(page.locator("#results")).toBeVisible({ timeout: 20000 });
  for (const width of [1920, 1440, 1280, 1050, 768, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    for (const locale of ["ru", "en",]) {
      await page.locator("#locale-switcher").selectOption(locale);
      await expect(page.locator("#result-body tr[data-result-role]")).toHaveCount(6);
      const geometry = await page.evaluate(() => ({
        width: innerWidth, scroll: document.documentElement.scrollWidth,
        columns: [...document.querySelectorAll(".provenance-row")].map(row =>
          [".provenance-entity", ".provenance-version", ".provenance-date"].map(selector =>
            row.querySelector(selector)!.getBoundingClientRect().x)),
      }));
      expect(geometry.scroll).toBeLessThanOrEqual(geometry.width);
      for (let column = 0; column < 3; column++) {
        expect(Math.max(...geometry.columns.map(row => row[column]))
          - Math.min(...geometry.columns.map(row => row[column]))).toBeLessThan(1);
      }
      await page.screenshot({ path: `output/playwright/ledger-${width}-${locale}.png`, fullPage: true });
    }
  }
  const explanation = page.locator('.formed-result-set [data-annotation="formed"]');
  await explanation.click();
  await expect(page.locator("#context-annotation")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(explanation).toBeFocused();
  await page.locator("#include-crossing").check();
  await expect(page.locator("#crossing-results-section")).toBeVisible();
  expect(errors).toEqual([]);
});
