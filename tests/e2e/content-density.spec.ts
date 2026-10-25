import { expect, test } from '@playwright/test';
import { layoutFixture, layoutQuery } from '../fixtures/layout.mjs';

for (const width of [390, 768, 1101, 1440, 2560]) test(`content scale, filter heights and overlays at ${width}`, async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width, height: 1100 });
  await page.route('**/data/hras-index.json', route => route.fulfill({ json: layoutFixture() }));
  await page.goto(layoutQuery);
  await expect(page.locator('#export-csv')).toBeEnabled();
  for (const locale of ['ru', 'en']) {
    const localizedQuery = layoutQuery.replace('lang=ru', `lang=${locale}`);
    await page.locator('#locale-switcher').selectOption(locale);
    const geometry = await page.evaluate(() => {
      const root = document.documentElement;
      const header = document.querySelector<HTMLElement>('.app-header')!;
      const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect().toJSON();
      const controls = ['#selection-panel-toggle', '#sample-scope', '#target-year', '#target-era', '.delta-stepper',
        '#min-result-samples', '#presence-mode-toggle', '#density-step', '#density-anchor', '.query-binary-switch'];
      const current = { header: rect('.app-header'), brand: rect('.brand-logo-text'),
        navigation: rect('.research-entrypoints button'), controls: Object.fromEntries(controls.map(s => [s, rect(s)])),
        scale: Number(getComputedStyle(root).zoom), overflow: root.scrollWidth > innerWidth };
      // Compare with the previous scale on this same viewport, without rebuilding another app.
      root.style.zoom = matchMedia('(min-width: 1280px)').matches ? '.8' : '1';
      header.style.zoom = '1';
      const previous = { header: rect('.app-header'), brand: rect('.brand-logo-text'), navigation: rect('.research-entrypoints button') };
      root.style.removeProperty('zoom'); header.style.removeProperty('zoom');
      return { current, previous };
    });
    await info.attach(`geometry-${locale}`, { body: JSON.stringify(geometry), contentType: 'application/json' });
    const { current, previous } = geometry;
    expect(current.overflow).toBe(false);
    expect(Math.abs(current.header.height - previous.header.height)).toBeLessThan(1);
    expect(Math.abs(current.brand.width - previous.brand.width)).toBeLessThan(1);
    expect(current.navigation.height / previous.navigation.height).toBeCloseTo(.8, 1);
    const heights = Object.values(current.controls).map(r => r.height);
    expect(Math.max(...heights) - Math.min(...heights), JSON.stringify(current.controls)).toBeLessThan(1);
    if (width > 1100) {
      const tops = ['#selection-panel-toggle', '#sample-scope', '#target-year', '.delta-stepper'].map(s => current.controls[s].top);
      expect(Math.max(...tops) - Math.min(...tops), JSON.stringify(current.controls)).toBeLessThan(1);
    }
    await page.locator('#max-delta-ybp').fill('450');
    await page.locator('#max-delta-ybp').press('Tab');
    await page.locator('[data-delta-step="50"]').click();
    await expect(page.locator('#max-delta-ybp')).toHaveValue('500');
    await page.locator('#include-crossing').check();
    await expect(page.locator('tr[data-result-role="crossing"]')).toHaveCount(3);
    await expect(page.locator('#export-csv')).toBeEnabled();
    await page.locator('[data-annotation="window"]').click();
    const panel = page.locator('#context-annotation');
    await expect(panel).toBeVisible();
    const box = (await panel.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(1101);
    await page.keyboard.press('Escape');
    await page.locator('#selection-panel-toggle').click();
    await expect(page.locator('#selection-panel')).toBeVisible();
    const dialog = (await page.locator('#selection-panel').boundingBox())!;
    expect(dialog.x).toBeGreaterThanOrEqual(0); expect(dialog.x + dialog.width).toBeLessThanOrEqual(width + 1);
    await page.keyboard.press('Escape');
    await page.locator('#include-crossing').uncheck();
    await expect(page.locator('#export-csv')).toBeEnabled();
    await page.mouse.move(0, 0); await page.locator('#locale-switcher').blur();
    await page.screenshot({ path: `output/content-density/time-${width}-${locale}.png` });
    if (width === 390 || width === 1440) {
      for (const route of ['view=profile&clade=J-SYN-ROOT', 'view=country-overview&country=RUS']) {
        await page.goto(`${localizedQuery}&${route}`);
        const profile = route.startsWith('view=profile');
        await expect(page.locator(profile ? '#profile-content [data-profile-select]' : '[data-research-group]').first()).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: `output/content-density/${profile ? 'profile' : 'country'}-${width}-${locale}.png` });
      }
      await page.goto(localizedQuery);
      await expect(page.locator('#export-csv')).toBeEnabled();
    }
  }
  expect(errors).toEqual([]);
});
