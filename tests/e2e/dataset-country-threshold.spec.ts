import fs from 'node:fs/promises';
import {expect, test} from '@playwright/test';
import {compact} from '../../scripts/semantic-audit/fixtures.mjs';

for (const width of [390, 1440]) for (const lang of ['ru', 'en']) {
  test(`dataset threshold follows sample type, retains optional flags and shared chart evidence: ${width} ${lang}`, async ({page}) => {
    const data = compact([-1, 0, -1, -1], [18000, 8600, 3000, null],
      [[1, 0, 2], [1, 1, 2], [2, 0, 8], [3, 1, 2], [3, 2, 1]]);
    data.ancientCounts = [1, 2, 0, 2, 1];
    data.countryCodes = ['RUS', 'POL', 'BLR']; data.projectIds = ['R'];
    data.nodeIds = ['R-SYN-ROOT', 'R-SYN-MATCH', 'R-SYN-RECENT', 'R-SYN-UNDATED'];
    const errors:string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({width, height:1000});
    await page.route('**/data/hras-index.json', route => route.fulfill({json:data}));
    await page.goto(`/?lang=${lang}&countries=RUS,POL,BLR&presence=all&target=8600&window=0&min=3`);
    const rows = page.locator('#result-body tr[data-result-role]');
    for (const scope of ['all', 'ancient', 'modern']) {
      await page.locator('#sample-scope').selectOption(scope);
      await expect(page.locator('#live-status')).toHaveAttribute('data-busy', 'false');
      await expect(rows).toHaveCount(1);
      await expect(rows.locator('.table-total strong')).toHaveText(scope === 'all' ? '4' : scope === 'ancient' ? '3' : '1');
      await expect(rows.locator('.country-pill-inactive')).toHaveCount(scope === 'ancient' ? 1 : 0);
      if (scope === 'ancient') await expect(rows.locator('.country-pill-inactive')).toContainText('RUS');
      await rows.locator('[data-result-countries]').click();
      const dialog = page.locator('#result-countries-dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText(lang === 'ru' ? 'по всей базе' : 'Dataset threshold');
      await expect(dialog.locator('[data-result-countries-group="active"] .result-country-item')).toHaveCount(scope === 'all' ? 2 : 1);
      await page.keyboard.press('Escape');
      const download = page.waitForEvent('download'); await page.locator('#export-csv').click();
      const csv = await fs.readFile((await (await download).path())!, 'utf8');
      expect(csv).toContain('per_selected_country_in_dataset_sample_scope');
      expect(csv).toContain('R-SYN-MATCH');
      const geometry = await page.locator('#query-min-control').evaluate(el => {
        const label = el.querySelector('label')!.getBoundingClientRect();
        const input = el.querySelector('input')!.getBoundingClientRect();
        return {labelBottom:label.bottom, inputTop:input.top, overflow:document.documentElement.scrollWidth-innerWidth};
      });
      expect(geometry.labelBottom).toBeLessThanOrEqual(geometry.inputTop);
      expect(geometry.overflow).toBeLessThanOrEqual(0);
      const optionFits = await page.locator('#sample-scope').evaluate((element:HTMLSelectElement) => {
        const style = getComputedStyle(element), context = document.createElement('canvas').getContext('2d')!;
        context.font = style.font;
        const available = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        return context.measureText(element.selectedOptions[0].text).width <= available;
      });
      expect(optionFits, `${scope}: selected sample type stays readable`).toBe(true);
    }
    await page.locator('#sample-scope').selectOption('ancient');
    await expect(rows.locator('.country-pill-inactive')).toHaveCount(1);
    await page.locator('[data-annotation="minimum"]').click();
    await expect(page.locator('#context-annotation')).toContainText(lang === 'ru' ? 'выбранного типа' : 'selected sample type');
    await page.screenshot({path:`output/dataset-threshold/threshold-${width}-${lang}.png`,fullPage:true});
    await page.keyboard.press('Escape');
    await page.locator('#target-year').fill('6551'); await page.locator('#target-year').press('Tab');
    await expect(rows).toHaveCount(0);
    await expect(page.locator('[data-suggest-ybp="8600"]')).toBeVisible();
    await page.locator('[data-suggest-ybp="8600"]').click();
    await expect(rows).toHaveCount(1);
    await expect(rows.locator('.country-pill-inactive')).toHaveCount(1);
    await page.locator('#min-result-samples').fill('0');
    await expect(rows).toHaveCount(0);
    await expect(page.locator('[data-suggest-ybp]')).toHaveCount(0);
    await expect(page.locator('#target-density button')).toHaveCount(0);
    await expect(page.locator('#country-minimum-reset-note')).toBeHidden();
    expect(errors).toEqual([]);
  });
}
