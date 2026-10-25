import { expect, test } from '@playwright/test';
import { layoutFixture, layoutQuery } from '../fixtures/layout.mjs';

test('mode panel geometry, keyboard and selected destinations', async ({ page }) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/data/hras-index.json', route => route.fulfill({ json: layoutFixture() }));
  await page.goto(layoutQuery);
  await expect(page.locator('#export-csv')).toBeEnabled();
  const nav = page.locator('.research-entrypoints');
  for (const width of [340, 390, 760, 761, 1050, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const locale of ['ru', 'en',]) {
      await page.locator('#locale-switcher').selectOption(locale);
      await expect(nav.getByRole('combobox')).toHaveCount(0);
      await expect(page.locator('.query-zone #sample-scope')).toHaveAccessibleName({ ru: 'Образцы', en: 'Samples', }[locale]!);
      for (const control of await nav.locator('[data-research-view], select').all()) {
        const box = (await control.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
        expect(await control.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        if (width <= 760) expect(box.height).toBeGreaterThanOrEqual(44);
      }
      const boxes = await nav.locator('[data-research-view], select').evaluateAll(elements => elements.map(el => { const r = el.getBoundingClientRect(); return { x:r.x,y:r.y,right:r.right,bottom:r.bottom }; }));
      for (let i=0;i<boxes.length;i++) for (let j=i+1;j<boxes.length;j++) {
        const a=boxes[i], b=boxes[j];
        expect(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y).toBe(true);
      }
      for (const view of ['profile', 'country-overview', 'time']) {
        const button = nav.locator(`[data-research-view="${view}"]`);
        await button.focus();
        await page.keyboard.press(view === 'country-overview' ? 'Space' : 'Enter');
        await expect(button).toHaveAttribute('aria-current', 'page');
        await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
        await expect(page.locator(view === 'time' ? '#time-workspace' : `[data-research-panel="${view}"]`)).toBeVisible();
        if (view === 'time') await expect(page.locator('#sample-scope')).toBeVisible();
        else await expect(page.locator('#sample-scope')).toBeHidden();
      }
      if (locale === 'ru') await nav.screenshot({ path: `output/mode-panel/panel-${width}.png` });
    }
  }
  expect(errors).toEqual([]);
});
