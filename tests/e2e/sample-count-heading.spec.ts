import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { layoutFixture, layoutQuery } from '../fixtures/layout.mjs';
import { parseCsv } from '../../scripts/semantic-audit/csv.mjs';
import { expectReadableText, measureTextStates } from './contrast-support';

for (const width of [390, 1440]) test(`sample count headings and plain totals at ${width}`, async ({ page }, info) => {
  test.setTimeout(60_000);
  const data = layoutFixture();
  data.ancientCounts = data.samples.map((sample: number[]) => Math.floor(sample[2] / 2));
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width, height: 1000 });
  await page.route('**/data/hras-index.json', route => route.fulfill({ json: data }));
  await page.goto(layoutQuery + '&crossing=1&samples=all');
  await expect(page.locator('#export-csv')).toBeEnabled();
  for (const locale of ['ru', 'en']) {
    await page.locator('#locale-switcher').selectOption(locale);
    for (const scope of ['all', 'ancient', 'modern']) {
      await page.locator('#sample-scope').selectOption(scope);
      await expect(page.locator('#export-csv')).toBeEnabled();
      await expect(page.locator('#sample-scope')).toHaveValue(scope);
      const word = locale === 'ru'
        ? ({ all: 'все', ancient: 'древние', modern: 'современные' } as const)[scope]
        : scope;
      const title = `${locale === 'ru' ? 'Образцы' : 'Samples'} (${word})`;
      for (const mode of ['formed', 'crossing']) {
        const head = page.locator(mode === 'formed' ? '#result-head' : '#crossing-result-head');
        const rows = page.locator(mode === 'formed' ? '#result-body tr[data-result-role]' : '#crossing-result-body tr[data-result-role]');
        const button = head.locator('[data-table-sort="total"]');
        await expect(button).toHaveAccessibleName(title);
        const qualifier = button.locator('.table-sample-scope-label');
        await expect(qualifier).toHaveText(word);
        if (scope === 'all') await expect(qualifier).not.toHaveClass(/is-filtered/);
        else {
          await expect(qualifier).toHaveCSS('color', 'rgb(180, 35, 24)');
          const readings = await measureTextStates(page, [{ name: `${mode}-${scope}`, control: button, text: qualifier }]);
          expectReadableText(readings);
          await info.attach(`contrast-${locale}-${mode}-${scope}`, { body: JSON.stringify(readings), contentType: 'application/json' });
        }
        await expect(rows.locator('.ancient-count-note')).toHaveCount(0);
        await expect(rows.first().locator('.table-total strong')).toHaveText(/^[\d\s\u00a0\u202f]+$/);
        if (width === 390) await expect(rows.first().locator('.mockup-support .mobile-cell-label')).toHaveText(title);
      }
      const downloadEvent = page.waitForEvent('download');
      await page.locator('#export-csv').click();
      const csv = parseCsv(await readFile((await (await downloadEvent).path())!, 'utf8'));
      expect(csv.length).toBeGreaterThan(0);
      expect(csv.every(row => row.sample_scope === scope && row.ancient_selected !== '')).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `output/sample-count-heading/${width}-${locale}-${scope}.png` });
    }
  }
  expect(errors).toEqual([]);
});
