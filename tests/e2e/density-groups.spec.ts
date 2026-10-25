import fs from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { densityReadingFixture } from '../fixtures/density-reading.mjs';

for (const width of [390, 1440]) test('source groups stay separate at ' + width + 'px', async ({ page }) => {
  const groups = ['A00', 'A0', 'A1a', 'A1b1', 'I1', 'I2', 'J1', 'J2', 'R1a', 'R1b', 'R2', 'BT', 'CT'];
  const data = densityReadingFixture(false, groups.length);
  data.projectIds = groups;
  for (let i = 1; i <= groups.length; i++) data.nodes[i][0] = i - 1;
  await page.setViewportSize({ width, height: 1000 });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/data/hras-index.json', route => route.fulfill({ json: data }));
  await page.goto('/?view=time&lang=ru&target=15000&window=300&min=5&presence=all&countries=RUS,POL');
  await expect(page.locator('#export-csv')).toBeEnabled();
  await page.locator('#density-step').fill(width === 390 ? '2400' : '1200');
  await page.locator('#density-step').press('Enter');
  const column = page.locator('button.density-cell[data-target-ybp="15000"]');
  const labels = await column.locator('.density-macro-letter').allTextContents();
  expect(labels.sort()).toEqual([...groups].sort());
  await expect(column.locator('.density-count')).toHaveText(String(groups.length));
  await expect(column).not.toHaveAttribute('data-tooltip', /A0-T/);
  const rows = page.locator('#result-body tr[data-result-role]');
  await expect(rows).toHaveCount(groups.length);
  for (const group of groups) {
    await expect(column).toHaveAttribute('data-tooltip', new RegExp(group + ' 1'));
    await expect(page.locator('#result-macrogroup-filter option').filter({ hasText: new RegExp('^' + group) }).first()).toBeAttached();
  }
  await page.locator('[data-annotation="density-groups"]').click();
  await expect(page.locator('#context-annotation')).toContainText('а не время возникновения');
  await expect(page.locator('#context-annotation a')).toHaveAttribute('href', 'https://www.yfull.com/tree/');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await fs.mkdir('output/density-groups', { recursive: true });
  await page.locator('.timeline-zone').screenshot({ path: 'output/density-groups/separate-' + width + '.png' });
  expect(errors).toEqual([]);
});
