import { expect, test } from '@playwright/test';
import { revealPreset } from "./preset-support";
import { layoutFixture, layoutQuery } from '../fixtures/layout.mjs';

test('source relationship and sync status remain visible in a compact ledger', async ({ page }) => {
  test.setTimeout(60000);
  await page.route('**/data/hras-index.json', route => route.fulfill({ json: layoutFixture() }));
  await page.goto(layoutQuery);
  await expect(page.locator('#export-csv')).toBeEnabled();
  for (const width of [1440, 1280, 1100, 1050, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const locale of ['en', 'ru']) {
      await page.locator('#locale-switcher').selectOption(locale);
      await expect(page.locator('[data-provenance-entity="hras"] .provenance-version [data-annotation="source-sync"]')).toBeVisible();
      await expect(page.locator('#provenance-notes')).toBeHidden();
      await expect(page.locator('[data-provenance-entity="app"] .provenance-version [data-annotation="snapshot-notes"]')).toBeVisible();
      await expect(page.locator('.provenance-privacy, .provenance-ancient')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      if (width === 1440) {
        const centers = await page.locator('.provenance-entity').evaluateAll(es => es.map(e => {
          const r = e.getBoundingClientRect(); return r.y + r.height / 2;
        }));
        expect(Math.abs((centers[1] - centers[0]) - (centers[2] - centers[1]))).toBeLessThan(1);
        for (const row of await page.locator('.provenance-row').all()) {
          const height = (await row.boundingBox())!.height;
          // The compact row must still fit its >=24 screen-pixel source targets.
          expect(height).toBeGreaterThanOrEqual(24);
          expect(height).toBeLessThanOrEqual(26);
          expect(await row.locator('.provenance-role').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        }
      }
      const repositories = await page.locator('.provenance-repository').evaluateAll(links => links.map(link => link.getBoundingClientRect().left));
      expect(Math.max(...repositories) - Math.min(...repositories)).toBeLessThan(1);
      for (const selector of ['.provenance-entity', '.provenance-version', '.provenance-date']) {
        const starts = await page.locator(selector).evaluateAll(elements => elements.map(el => el.getBoundingClientRect().left));
        expect(Math.max(...starts) - Math.min(...starts)).toBeLessThan(1);
      }
      const dateHelp = await page.locator('.provenance-date .annotation-trigger').evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().left));
      expect(Math.max(...dateHelp) - Math.min(...dateHelp)).toBeLessThan(1);
      await page.locator('[data-annotation="source-sync"]').click();
      await expect(page.locator('#context-annotation')).toContainText('HRAS');
      await expect(page.locator('#context-annotation')).toContainText('YFull');
      if (locale === 'ru') await expect(page.locator('#context-annotation')).toContainText('независимые версии');
      await expect(page.locator('#context-annotation .provenance-sample-coverage')).toBeVisible();
      if (locale === 'ru' && [390, 1440].includes(width)) await page.locator('#context-annotation').screenshot({ path: `output/compact-locale/hras-note-${width}.png` });
      await page.keyboard.press('Escape');
      await page.locator('[data-annotation="snapshot-notes"]').click();
      await expect(page.locator('#context-annotation')).toContainText('YFull/YTree');
      await expect(page.locator('#context-annotation .provenance-sample-coverage')).toHaveCount(0);
      await expect(page.locator('#context-annotation .annotation-facts')).toBeVisible();
      if (locale === 'ru' && [390, 1440].includes(width)) await page.locator('#context-annotation').screenshot({ path: `output/compact-locale/index-note-${width}.png` });
      await page.keyboard.press('Escape');
      for (const [id, phrase] of [['hras-date', 'манифесте'], ['yfull-date', 'репозитории'], ['index-date', 'сборки']]) {
        await page.locator(`[data-annotation="${id}"]`).click();
        if (locale === 'ru') await expect(page.locator('#context-annotation')).toContainText(phrase);
        await expect(page.locator('#context-annotation .annotation-facts')).toBeVisible();
        expect(await page.locator('#context-annotation').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        if (locale === 'ru' && width === 390) await page.locator('#context-annotation').screenshot({ path: `output/compact-locale/${id}-note.png` });
        await page.keyboard.press('Escape');
      }
    }
    await page.screenshot({ path: `output/compact-locale/sources-${width}.png` });
  }
});

for (const width of [390, 1440]) {
  test(`current language survives contextual and browser history at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/data/hras-index.json', route => route.fulfill({ json: layoutFixture() }));
    await page.goto(layoutQuery);
    await page.locator('#result-body [data-open-result-detail="R-SYN-100"]').click();
    await page.locator('#locale-switcher').selectOption('en');
    await page.locator('[data-research-panel="profile"] [data-research-back]').click();
    await expect(page.locator('#time-workspace')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    expect(new URL(page.url()).searchParams.get('lang')).toBe('en');
    await page.goForward();
    await expect(page.locator('#profile-content h3').first()).toHaveText('R-SYN-100');
    await page.locator('#locale-switcher').selectOption('ru');
    await page.goBack();
    await expect(page.locator('#time-workspace')).toBeVisible();
    await expect(page.locator('#locale-switcher')).toHaveValue('ru');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await expect(page.locator('#export-csv')).toBeEnabled();
    // A fresh direct URL still defines its own initial language.
    await page.goto(layoutQuery);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  });

  test(`compact header and anchored notes at ${width}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/data/hras-index.json', route => route.fulfill({ json: layoutFixture() }));
    await page.goto(layoutQuery);
    await expect(page.locator('#export-csv')).toBeEnabled();
    expect(await page.locator('html').evaluate(el => Number(getComputedStyle(el).zoom))).toBe(width >= 1280 ? .64 : .8);
    for (const row of await page.locator('.provenance-row').all()) {
      const license = await row.locator('.provenance-links > a').nth(2).boundingBox();
      const github = await row.locator('.provenance-repository').boundingBox();
      expect(Math.abs(github!.y - license!.y)).toBeLessThan(2);
      expect(github!.x - license!.x - license!.width).toBeGreaterThanOrEqual(0);
      expect(github!.x - license!.x - license!.width).toBeLessThan(12);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `output/compact-locale/header-${width}.png` });
    const note = page.locator('[data-annotation="window"]');
    await note.click();
    const trigger = await note.boundingBox(), panel = await page.locator('#context-annotation').boundingBox();
    // Edge triggers may shift the note horizontally to keep the whole panel visible.
    expect(panel!.x).toBeGreaterThanOrEqual(0);
    expect(panel!.x + panel!.width).toBeLessThanOrEqual(width);
    expect(trigger!.x + trigger!.width / 2).toBeGreaterThan(panel!.x);
    expect(trigger!.x + trigger!.width / 2).toBeLessThan(panel!.x + panel!.width);
    expect(panel!.y - trigger!.y - trigger!.height).toBeGreaterThan(0);
    expect(panel!.y - trigger!.y - trigger!.height).toBeLessThan(10);
    await page.screenshot({ path: `output/compact-locale/note-${width}.png` });
    await page.keyboard.press('Escape');
    await page.locator('#selection-panel-toggle').click();
    const disclosure = page.locator('[data-toggle-presets]');
    if (await disclosure.isVisible()) await disclosure.click();
    await revealPreset(page, "arch-yamnaya");
    const info = page.locator('[data-preset-info="arch-yamnaya"]');
    await info.click();
    const card = info.locator('..').locator('.preset-members-tooltip');
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(901);
    await page.screenshot({ path: `output/compact-locale/preset-${width}.png` });
    expect(errors).toEqual([]);
  });
}
