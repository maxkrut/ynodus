import fs from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { layoutFixture, layoutQuery } from '../fixtures/layout.mjs';

for (const width of [320, 390, 1440]) test('result reading and actions at ' + width + 'px', async ({ page }) => {
  const data = layoutFixture(); data.nodes[2][2] = 5500;
  await page.route('**/data/hras-index.json', route => route.fulfill({ json: data }));
  await page.setViewportSize({ width, height: 1000 });
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(layoutQuery + '&crossing=1');
  await expect(page.locator('#export-csv')).toBeEnabled();
  await expect(page.locator('#result-query')).toContainText('Дата поиска:');
  await expect(page.locator('.formed-result-set .result-reading-line')).toContainText('по выбранным странам');
  await expect(page.locator('[data-result-composition]').first()).toHaveAttribute('data-tooltip', /одна округлённая оценка Formed/);
  for (const locale of ['ru', 'en',]) {
    await page.locator('#locale-switcher').selectOption(locale);
    const composition = page.locator('[data-result-composition]').first();
    await composition.click();
    const popup = page.locator('#context-annotation');
    await expect(popup).toContainText(locale === 'ru' ? 'Состав результата' : 'Result composition');
    await expect(popup).toContainText(locale === 'ru' ? 'за пределами окна поиска' : 'outside the search window');
    await page.mouse.move(0, 0);
    await expect(popup).toBeVisible();
    expect(await popup.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    await popup.screenshot({ path: `output/result-composition/popup-${width}-${locale}.png` });
    await page.keyboard.press('Escape');
    await expect(popup).toBeHidden();
    await composition.click();
    await page.locator('.result-reading-line').first().click();
    await expect(popup).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const geometry = await page.locator('#result-body tr[data-result-role]').first().evaluate(row => {
      const profile = row.querySelector('.table-profile-action')!;
      const range = document.createRange(); range.selectNodeContents(profile);
      const p = profile.getBoundingClientRect(), identity = row.querySelector('.table-branch-identity')!.getBoundingClientRect();
      return { lines: range.getClientRects().length, gap: p.left - identity.right, content: profile.scrollWidth, box: profile.clientWidth };
    });
    expect(geometry.lines).toBe(1); expect(geometry.gap).toBeGreaterThanOrEqual(0);
    expect(geometry.content).toBeLessThanOrEqual(geometry.box);
    await expect(page.locator('#result-head [data-table-sort="delta"]')).toHaveAttribute('data-tooltip', /.+/);
    await expect(page.locator('#result-head [data-table-sort="delta"]')).not.toHaveAttribute('title');
  }
  await page.locator('#locale-switcher').selectOption('ru');
  await page.locator('#result-head [data-table-sort="delta"]').hover();
  await expect(page.locator('#context-annotation')).toContainText('от выбранной даты');
  await page.keyboard.press('Escape');
  await page.locator('#result-head [data-table-sort="delta"]').click();
  await expect(page.locator('#result-head th[aria-sort="ascending"] [data-table-sort="delta"]')).toBeVisible();
  const first = page.locator('#result-body tr[data-result-role]').first();
  await expect(first.locator('a.table-yfull-action')).toHaveAttribute('target', '_blank');
  await expect(first.locator('a.table-yfull-action')).toContainText('↗');
  await page.locator('.results-zone').evaluate(e => e.scrollIntoView({block:'start'}));
  await fs.mkdir('output/results-reading', {recursive:true});
  await page.screenshot({path:'output/results-reading/verified-' + width + '.png'});
  await first.locator('[data-open-result-detail]').click();
  await expect(page).toHaveURL(/view=profile/);
  expect(errors).toEqual([]);
});
