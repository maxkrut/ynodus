import { expect, test, type Locator, type Page } from '@playwright/test';
import { compact } from '../../scripts/semantic-audit/fixtures.mjs';

const countries = ['RUS', 'POL', 'UKR', 'DEU', 'FIN', 'GBR', 'FRA', 'AUT', 'ITA', 'KAZ', 'CHN', 'IND'];
function fixture() {
  const parents = [-1, ...Array(60).fill(0)], ages = [18000, ...Array(60).fill(5500)];
  const samples = parents.flatMap((_, node) => node === 0 ? [] : countries.map((_, country) => [node, country, 1]));
  const data = compact(parents, ages, samples);
  data.nodeIds = parents.map((_, i) => i === 0 ? 'R-SYN-ROOT' : `R-SYN-${i}`);
  data.projectIds = ['R']; data.countryCodes = countries; data.countryCounts = countries.map(() => 60);
  data.hrasManifestSampleCount = 60 * countries.length;
  return data;
}

async function pressBottomEdge(page: Page, target: Locator, mobile: boolean) {
  await target.scrollIntoViewIfNeeded();
  const box = (await target.boundingBox())!;
  if (mobile) { expect(box.height).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThanOrEqual(44); }
  await page.mouse.click(box.x + box.width / 2, box.y + box.height - 2);
  return box;
}

for (const width of [320, 390, 760, 761, 1440]) {
  test(`country disclosures and pagination retain usable targets at ${width}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/data/hras-index.json', route => route.fulfill({ json: fixture() }));
    for (const locale of ['ru', 'en']) {
      await page.goto(`/?lang=${locale}&countries=${countries.join(',')}&presence=any&min=0&target=5500&window=0`);
      await page.locator('#locale-switcher').selectOption(locale);
      await expect(page.locator('#export-csv')).toBeEnabled();
      const url = page.url(), resultCount = await page.locator('#result-count').textContent();
      const rows = page.locator('#result-body tr[data-result-role]');
      await expect(rows).toHaveCount(50);
      const first = rows.first();
      const pills = first.locator(width <= 760 ? '.country-pills-mobile' : '.country-pills-desktop');
      const details = pills.locator('.chip-details'), summary = details.locator('summary');
      const closed = await pressBottomEdge(page, summary, width <= 760);
      await expect(details).toHaveAttribute('open', '');
      await expect(pills.locator('.country-pill')).toHaveCount(countries.length);
      const expanded = (await summary.boundingBox())!;
      if (width <= 760) expect(expanded.height).toBeGreaterThanOrEqual(44);
      if (width === 390 || width === 1440) {
        await first.screenshot({ path: `output/mobile-target/countries-${width}-${locale}.png` });
      }
      await summary.focus(); await page.keyboard.press('Enter');
      await expect(details).not.toHaveAttribute('open', '');
      await expect(rows).toHaveCount(50);

      await page.locator('#selection-panel-toggle').click();
      const picker = page.locator('#selection-panel');
      const selectedDetails = picker.locator('.selected-more'), selectedSummary = selectedDetails.locator('summary');
      const selected = await pressBottomEdge(page, selectedSummary, width <= 760);
      await expect(selectedDetails).toHaveAttribute('open', '');
      await expect(selectedDetails.locator('.chip-popover')).toBeVisible();
      await expect(picker.locator('.country-option input:checked')).toHaveCount(countries.length);
      await selectedSummary.focus(); await page.keyboard.press('Enter');
      await expect(selectedDetails).not.toHaveAttribute('open', '');
      await page.keyboard.press('Escape');

      const more = page.locator('.formed-result-set .show-more-row button');
      const pagination = await pressBottomEdge(page, more, width <= 760);
      await expect(rows).toHaveCount(60);
      await expect(more).toHaveCount(0);
      await expect(page.locator('#export-csv')).toBeEnabled();
      await expect(page.locator('#result-count')).toHaveText(resultCount ?? '');
      expect(page.url()).toBe(url);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await info.attach(`targets-${locale}`, { body: JSON.stringify({ closed, expanded, selected, pagination }), contentType: 'application/json' });
    }
    expect(errors).toEqual([]);
  });
}
