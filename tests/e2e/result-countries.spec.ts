import fs from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { compact } from "../../scripts/semantic-audit/fixtures.mjs";

function fixture() {
  const data = compact([-1, 0, 0], [25000, 19300, 19300],
    [[1, 0, 4], [1, 1, 1], [1, 2, 2], [2, 0, 1], [2, 1, 2], [0, 3, 1]]);
  data.countryCodes = ["RUS", "POL", "BLR", "UKR"];
  data.countryCounts = [5, 3, 2, 1];
  data.hrasManifestSampleCount = 11;
  data.nodeIds = ["R-SYN-ROOT", "R-SYN-ONE", "R-SYN-TWO"];
  data.projectIds = ["R"];
  return data;
}

for (const width of [390, 1440]) test(`country summary explains pool minimum and preserves flags at ${width}`, async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width, height: 1000 });
  await page.route("**/data/hras-index.json", route => route.fulfill({ json: fixture() }));
  await page.goto("/?lang=ru&countries=RUS,POL,BLR,UKR&presence=all&target=19300&window=200&min=3");
  const row = page.locator('#result-body tr[data-result-role]').filter({ hasText: "R-SYN-ONE" });
  await expect(row).toHaveCount(1);
  const flags = await row.locator('.country-pill').allTextContents();
  const opener = row.locator('[data-result-countries]');
  await opener.click();
  const dialog = page.locator('#result-countries-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('h3')).toHaveText('R-SYN-ONE: 3 страны представлены');
  await expect(dialog.locator('[data-result-countries-group="active"] .result-country-item')).toHaveCount(2);
  await expect(dialog.locator('[data-result-countries-group="active"]')).toContainText('Польша');
  await expect(dialog.locator('[data-result-countries-group="active"] strong')).toHaveText(['4', '1']);
  await expect(dialog.locator('[data-result-countries-group="below"] .result-country-item')).toHaveCount(1);
  await expect(dialog.locator('[data-result-countries-group="below"]')).toContainText('Беларусь');
  await expect(dialog.locator('footer')).toContainText('ветви: 1');
  const geometry = await dialog.evaluate(el => {
    const box = el.getBoundingClientRect();
    const deltas = [...el.querySelectorAll('.result-country-item')].map(item => {
      const children = [...item.children].map(child => child.getBoundingClientRect());
      const centers = children.map(box => box.top + box.height / 2);
      return Math.max(...centers) - Math.min(...centers);
    });
    return { left: box.left, right: box.right, bottom: box.bottom, delta: Math.max(...deltas), fits: el.scrollWidth <= el.clientWidth + 1 };
  });
  expect(geometry.left).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(width);
  expect(geometry.bottom).toBeLessThanOrEqual(1000);
  expect(geometry.delta).toBeLessThanOrEqual(1);
  expect(geometry.fits).toBe(true);
  await fs.mkdir('output/country-summary', { recursive: true });
  await dialog.screenshot({ path: `output/country-summary/synthetic-${width}.png` });
  await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();
  expect(await row.locator('.country-pill').allTextContents()).toEqual(flags);
  await opener.click();
  await page.keyboard.press('Tab');
  expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await dialog.locator('[data-close-result-countries]').click();
  await expect(opener).toBeFocused();
  expect(errors).toEqual([]);
});

test('strict zero, All branches and Crossing use their own committed country rules', async ({ page }) => {
  await page.route('**/data/hras-index.json', route => route.fulfill({ json: fixture() }));
  for (const lang of ['ru', 'en',]) {
    await page.goto(`/?lang=${lang}&countries=RUS,POL&presence=all&target=19300&window=200&min=0`);
    await page.locator('#result-body [data-result-countries]').first().click();
    const dialog = page.locator('#result-countries-dialog');
    await expect(dialog.locator('[data-result-countries-group="active"] .result-country-item')).toHaveCount(2);
    await expect(dialog.locator('[data-result-countries-group="below"]')).toHaveCount(0);
    await page.keyboard.press('Escape');
  }
  await page.goto('/?lang=ru&countries=RUS,POL,BLR,UKR&presence=any&target=22000&window=0&crossing=1&min=99');
  await page.locator('#crossing-result-body [data-result-countries]').first().click();
  const dialog = page.locator('#result-countries-dialog');
  await expect(dialog).toContainText('минимум не применяется');
  await expect(dialog.locator('[data-result-countries-group="below"]')).toHaveCount(0);
  await expect(dialog.locator('h3')).toContainText('R-SYN-ROOT → R-SYN-ONE');
  await page.keyboard.press('Escape');
});
