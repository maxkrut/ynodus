import { expect, test } from '@playwright/test';
import { layoutFixture, layoutQuery } from '../fixtures/layout.mjs';

for (const width of [390, 1440]) for (const locale of ['ru', 'en']) {
  test(`interval tooltip waits one second and dismisses after selection or pointer exit: ${width} ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/data/hras-index.json', route => route.fulfill({ json: layoutFixture() }));
    await page.goto(layoutQuery.replace('lang=ru', `lang=${locale}`));
    await expect(page.locator('#export-csv')).toBeEnabled();
    const column = page.locator('button.density-cell').first();
    const panel = page.locator('#context-annotation');
    await column.scrollIntoViewIfNeeded();
    await page.mouse.move(1, 1);
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await column.hover();
    await page.clock.runFor(999);
    await expect(panel).toBeHidden();
    await page.clock.runFor(1);
    await expect(panel).toBeVisible();
    await expect(panel).toContainText(locale === 'ru' ? 'Состав интервала' : 'Interval composition');
    await panel.hover();
    await page.clock.runFor(200);
    await expect(panel).toBeVisible();
    await page.mouse.move(1, 1);
    await page.clock.runFor(200);
    await expect(panel).toBeHidden();
    await column.hover();
    await page.clock.runFor(500);
    await page.mouse.move(1, 1);
    await page.clock.runFor(1000);
    await expect(panel).toBeHidden();
    await column.hover();
    await page.clock.runFor(1000);
    await expect(panel).toBeVisible();
    await page.clock.resume();
    await column.click();
    await expect(page.locator('#live-status')).toHaveAttribute('data-busy', 'false');
    await expect(panel).toBeHidden();
    await page.waitForTimeout(1100);
    await expect(panel).toBeHidden();
    // A deliberate keyboard focus can still inspect the selected interval.
    await page.mouse.move(1, 1);
    await page.keyboard.press('Tab');
    await column.focus();
    await expect(panel).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
  });
}
