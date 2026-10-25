import { expect, test } from '@playwright/test';
import { layoutFixture, layoutQuery } from '../fixtures/layout.mjs';

test('two-row filters retain adjacent date/window controls without cumulative samples', async ({ page }) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/data/hras-index.json', route => route.fulfill({ json: layoutFixture() }));
  await page.goto(layoutQuery);
  await expect(page.locator('#export-csv')).toBeEnabled();
  await expect(page.locator('.query-zone .inline-method-note')).toHaveCount(0);
  await expect(page.locator('.query-zone [data-annotation="countries"]')).toBeVisible();
  await expect(page.locator('#sample-timeline-toggle, #sample-timeline')).toHaveCount(0);
  const rows = await page.locator('#result-body tr[data-result-role="formed"]').count();
  for (const width of [340, 390, 760, 761, 1100, 1101, 1440, 2560]) {
    await page.setViewportSize({ width, height: 1100 });
    for (const locale of ['ru', 'en',]) {
      await page.locator('#locale-switcher').selectOption(locale);
      const geometry = await page.locator('.query-zone').evaluate(panel => {
        const boxes = [...panel.querySelectorAll<HTMLElement>(
          '#sample-scope, #selection-panel-toggle, #min-result-samples, #presence-mode-toggle, #target-year, #target-era, .delta-stepper, .query-binary-switch, #density-step, #density-anchor, .density-sync-label')]
          .filter(el => el.getClientRects().length).map(el => el.getBoundingClientRect());
        const bounds = panel.getBoundingClientRect();
        const date = panel.querySelector('#query-target-control')!.getBoundingClientRect();
        const window = panel.querySelector('#query-delta-control')!.getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          outside: boxes.some(b => b.left < bounds.left - 1 || b.right > bounds.right + 1),
          overlap: boxes.some((a, i) => boxes.some((b, j) => i < j && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1)),
          datesAdjacent: Math.abs(date.top - window.top) < 1 && window.left >= date.right,
        };
      });
      expect(geometry, `${width}/${locale}`).toEqual({ overflow: false, outside: false, overlap: false, datesAdjacent: true });
      await expect(page.locator('#result-body tr[data-result-role="formed"]')).toHaveCount(rows);
      if (locale === 'ru' && [390, 1440].includes(width)) {
        await page.locator('.timeline-zone').screenshot({ path: `output/formed-density/production-${width}.png` });
      }
    }
  }
  expect(errors).toEqual([]);
});
