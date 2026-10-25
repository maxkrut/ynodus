import { checkSourceExplanations } from "./production-smoke-support";
import { expect, test, type Page } from "@playwright/test";
import { revealPreset } from "./preset-support";

async function start(page: Page) {
  await page.goto("/");
  await expect(page.locator("#result-body tr[data-result-role]").first()).toBeVisible({ timeout: 20_000 });
}

test("audit: localized landmarks, truthful disclosures, nested group roles", async ({ page }) => {
  await start(page);
  const names = new Set<string>();
  for (const locale of ["ru", "en",]) {
    await page.locator("#locale-switcher").selectOption(locale);
    names.add((await page.locator(".research-entrypoints").getAttribute("aria-label"))!);
    const tableName = await page.locator('table[data-result-mode="formed"]').getAttribute("aria-label");
    expect(tableName).toBeTruthy();
    if (locale !== "ru") expect(tableName).not.toMatch(/[а-я]/i);
    const row = page.locator('#result-body tr[data-result-role]').filter({ has: page.locator('[data-open-result-detail="J-Z600"]') });
    const disclosure = row.locator('.country-pills-desktop details').first();
    await disclosure.locator("summary").click();
    await expect(disclosure.locator(".disclosure-more")).toBeHidden();
    await expect(disclosure.locator(".disclosure-less")).toBeVisible();
    await disclosure.locator("summary").click();
    await expect(row.locator(".formed-branch-summary-text")).toBeVisible();
    await row.locator('[data-open-result-detail="J-Z600"]').click();
    const groups = page.locator("#profile-content .profile-formed-context");
    await expect(groups).toContainText("J-Z615");
    await expect(page.locator(".formed-branch-dialog")).toHaveCount(0);
    await page.locator('#profile-workspace [data-research-back]').click();
  }
  expect(names.size).toBe(2);
});

test("audit: preset details stay inside the dialog and selected count survives scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await start(page);
  await page.locator("#selection-panel-toggle").click();
  await revealPreset(page, "arabic");
  const button = page.locator('[data-country-preset-option="arabic"]');
  await button.hover();
  const tip = button.locator("..").locator(".preset-members-tooltip");
  await expect(tip).toBeHidden();
  await button.locator("..").locator("[data-preset-info]").click();
  await expect(tip).toBeVisible();
  const bounds = (await tip.boundingBox())!;
  const dialog = (await page.locator("#selection-panel").boundingBox())!;
  expect(bounds.y).toBeGreaterThanOrEqual(dialog.y);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(dialog.y + dialog.height);
  await page.mouse.move(bounds.x + 20, bounds.y + 20);
  await expect(tip).toBeVisible();
  await page.locator("#country-search").click();
  await page.locator('[data-country-action="all"]').click();
  await page.locator("#country-list input").last().focus();
  const count = (await page.locator("#picker-selected-count").boundingBox())!;
  expect(count.y).toBeGreaterThanOrEqual(dialog.y);
  expect(count.y + count.height).toBeLessThanOrEqual(dialog.y + dialog.height);
  await expect(page.locator("#picker-selected-count")).toContainText(String(await page.locator("#country-list input:checked").count()));
});

test("audit: mobile country preview and log boundary stay visible in both languages", async ({ page }) => {
  await start(page);
  await checkSourceExplanations(page);
  for (const width of [320, 390, 720, 760]) {
    await page.setViewportSize({ width, height: 844 });
    for (const locale of ["ru", "en",]) {
      await page.locator("#locale-switcher").selectOption(locale);
      await expect(page.locator("#selected-country-flags")).toBeVisible();
      await expect(page.locator("#axis-bce-mid")).toBeVisible();
      const countries = (await page.locator("#selection-panel-toggle").boundingBox())!;
      const query = (await page.locator(".query-scope-row").boundingBox())!;
      expect(countries.x).toBeGreaterThanOrEqual(query.x);
      expect(countries.x + countries.width).toBeLessThanOrEqual(query.x + query.width + 1);
      await expect(page.locator("#tab-subclades")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const noteBounds = await page.locator(".provenance-ledger").boundingBox();
      expect(noteBounds!.x).toBeGreaterThanOrEqual(0);
      expect(noteBounds!.x + noteBounds!.width).toBeLessThanOrEqual(width);
      const left = (await page.locator("#axis-bce-end").boundingBox())!;
      const middle = (await page.locator("#axis-bce-mid").boundingBox())!;
      expect(left.x + left.width).toBeLessThanOrEqual(middle.x);
    }
  }
});

test("audit: loading provenance does not overlap adjacent links", async ({ page }) => {
  await page.route("**/data/hras-index.json", () => {});
  await page.goto("/");
  await checkSourceExplanations(page);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const locale of ["ru", "en",]) {
      await page.locator("#locale-switcher").selectOption(locale);
      const collisions = await page.locator(".provenance-row").evaluateAll((rows) => rows.some((row) => {
        const date = row.querySelector(".provenance-date time")!;
        const range = document.createRange(); range.selectNodeContents(date);
        const text = range.getBoundingClientRect();
        return [...document.querySelectorAll(".provenance-links")].some(nav => {
          const links = nav.getBoundingClientRect();
          return text.right > links.left && text.left < links.right && text.top < links.bottom && text.bottom > links.top;
        });
      }));
      expect(collisions).toBe(false);
    }
  }
});
