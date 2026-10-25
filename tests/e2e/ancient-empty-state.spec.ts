import { expect, test } from '@playwright/test';
import { compact } from '../../scripts/semantic-audit/fixtures.mjs';

for (const width of [390, 1440]) for (const locale of ['ru', 'en']) {
  test(`ancient-only filter is explicit and clears correctly at ${width} ${locale}`, async ({ page }) => {
    const data = compact([-1, 0], [6000, 5000], [[1, 0, 10], [1, 1, 12]]);
    data.countryCodes = ['RUS', 'FRA', 'DEU']; data.ancientCounts = [2, 3];
    await page.route('**/data/hras-index.json', route => route.fulfill({ json: data }));
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/?lang=${locale}&view=time&target=6000&window=0&min=5&presence=all&countries=RUS,FRA&samples=ancient&crossing=1`);
    const select = page.locator('#sample-scope');
    const marker = page.locator('#result-body .empty-ancient-scope');
    const note = page.locator('#country-minimum-reset-note');
    const label = locale === 'ru' ? 'Только древние' : 'Ancient only';
    const scope = locale === 'ru' ? 'Только древние образцы.' : 'Ancient samples only.';
    await expect(select).toHaveAttribute('data-active-sample-scope', 'ancient');
    await expect(select.locator('option:checked')).toHaveText(label);
    await expect(marker).toHaveText(scope);
    await expect(page.locator('#crossing-result-body .empty-ancient-scope')).toHaveText(scope);
    await expect(note).toContainText(scope);
    await expect(page.locator('#result-body')).toContainText(locale === 'ru' ? 'выберите «Все» в поле «Образцы»' : 'select All under Samples');
    const paint = await select.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(paint).toBe('rgb(255, 244, 214)');
    const labelSize = await select.evaluate(el => {
      const style = getComputedStyle(el), context = document.createElement('canvas').getContext('2d')!;
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      return { required: context.measureText((el as HTMLSelectElement).selectedOptions[0].text).width +
        parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + 20, available: el.clientWidth };
    });
    expect(labelSize.required, JSON.stringify(labelSize)).toBeLessThanOrEqual(labelSize.available);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('.query-zone').screenshot({ path: `output/ancient-empty/filter-${width}-${locale}.png` });
    await page.locator('.results-zone').screenshot({ path: `output/ancient-empty/result-${width}-${locale}.png` });
    for (const [sampleScope, total] of [['all', '22'], ['modern', '17']]) {
      await select.selectOption(sampleScope);
      await expect(page.locator('#result-body .table-total strong')).toHaveText(total);
      await expect(select).toHaveAttribute('data-active-sample-scope', sampleScope);
      expect(await select.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(paint);
      await expect(marker).toHaveCount(0);
      await expect(note).toBeHidden();
    }
    await page.goBack(); await expect(select).toHaveValue('all');
    await page.goBack(); await expect(select).toHaveValue('ancient');
    await expect(marker).toHaveText(scope);
    await page.locator('[data-accept-country-minimum]').click();
    await expect(page.locator('#result-body .table-total strong')).toHaveText('5');
    await expect(select).toHaveValue('ancient');
    await expect(marker).toHaveCount(0);
    await page.locator('#result-body [data-open-result-detail]').click();
    await expect(page.locator('#profile-sample-scope')).toHaveAttribute('data-active-sample-scope', 'ancient');
    await expect(page.locator('#profile-sample-scope option:checked')).toHaveText(label);
    expect(errors).toEqual([]);
  });
}
