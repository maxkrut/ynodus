import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { compact } from '../../scripts/semantic-audit/fixtures.mjs';
import { parseCsv } from '../../scripts/semantic-audit/csv.mjs';

function sortingFixture() {
  const parents: number[] = [], ages: number[] = [], samples: number[][] = [];
  const projects: number[] = [], ids: string[] = [];
  for (let i = 0; i < 65; i++) {
    parents.push(-1); ages.push(5500 + i % 5 * 10); projects.push(i % 3);
    ids.push(`R-SYN-FORMED-${String(i).padStart(2, '0')}`);
    samples.push([i, 0, 1 + i % 7], [i, 1, 2 + i % 4]);
  }
  for (let i = 0; i < 5; i++) {
    const parent = parents.length;
    parents.push(-1, parent); ages.push(7000 + i * 50, 3000);
    projects.push(i % 3, i % 3);
    ids.push(`R-SYN-PARENT-${i}`, `R-SYN-CHILD-${i}`);
    samples.push([parent + 1, 0, 10 - i], [parent + 1, 1, i % 2 + 1]);
  }
  const data = compact(parents, ages, samples);
  data.nodeIds = ids;
  data.nodes = parents.map((parent, i) => [projects[i], parent, ages[i]]);
  data.projectIds = ['R', 'I', 'J'];
  data.countryCodes = ['RUS', 'POL', 'DEU'];
  return data;
}

for (const [locale, width] of [['ru', 1440], ['en', 390]] as const) {
  test(`CSV follows table sorting, filtering and disclosure in ${locale} at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/data/hras-index.json', route => route.fulfill({ json: sortingFixture() }));
    await page.goto(`/?lang=${locale}&countries=RUS,POL&presence=any&target=5500&window=100&min=0&crossing=1`);
    const formed = page.locator('#result-body tr[data-result-role]');
    const crossing = page.locator('#crossing-result-body tr[data-result-role]');
    await expect(formed).toHaveCount(50);
    await expect(crossing).toHaveCount(5);

    async function checkOrder(expectedFormed: number) {
      const event = page.waitForEvent('download');
      await page.locator('#export-csv').click();
      const download = await event;
      const records = parseCsv(await readFile((await download.path())!, 'utf8'));
      const csvFormed = records.filter(row => row.result_mode === 'formed');
      expect(csvFormed).toHaveLength(expectedFormed);
      for (const [mode, rows] of [['formed', formed], ['crossing', crossing]] as const) {
        const ui = (await rows.locator('.table-branch-identity').allTextContents())
          .map(text => text.trim().replace(/\s*→\s*/g, ' > '));
        const csv = records.filter(row => row.result_mode === mode).map(row => row.result_identity);
        expect(csv.slice(0, ui.length)).toEqual(ui);
        if (mode === 'crossing') expect(csv).toHaveLength(await rows.count());
      }
      return records;
    }

    await checkOrder(65);
    for (const key of ['subclade', 'formed', 'delta', 'total']) {
      for (const direction of ['ascending', 'descending']) {
        const button = page.locator(`#result-head [data-table-sort="${key}"]`);
        const header = button.locator('xpath=ancestor::th');
        for (let clicks = 0; clicks < 2 && await header.getAttribute('aria-sort') !== direction; clicks++) {
          await button.click();
        }
        await expect(header).toHaveAttribute('aria-sort', direction);
        await expect(page.locator('#crossing-result-head [data-table-sort="total"]').locator('xpath=ancestor::th'))
          .toHaveAttribute('aria-sort', 'descending');
        await checkOrder(65);
      }
    }
    for (const key of ['subclade', 'formed', 'total']) {
      for (const direction of ['ascending', 'descending']) {
        const button = page.locator(`#crossing-result-head [data-table-sort="${key}"]`);
        const header = button.locator('xpath=ancestor::th');
        for (let clicks = 0; clicks < 2 && await header.getAttribute('aria-sort') !== direction; clicks++) {
          await button.click();
        }
        await expect(header).toHaveAttribute('aria-sort', direction);
        await expect(page.locator('#result-head [data-table-sort="total"]').locator('xpath=ancestor::th'))
          .toHaveAttribute('aria-sort', 'descending');
        await checkOrder(65);
      }
    }

    await page.locator('#result-body [data-show-more-results]').click();
    await expect(formed).toHaveCount(65);
    await checkOrder(65);
    await page.locator('#result-macrogroup-filter').selectOption('I');
    await expect(formed).toHaveCount(22);
    const filtered = await checkOrder(22);
    expect(filtered.filter(row=>row.result_mode==='formed')
      .every(row => row.macrogroup === 'I' && row.macrogroup_filter === 'I')).toBe(true);
    expect(filtered.filter(row=>row.result_mode==='crossing')).toHaveLength(5);
    expect(filtered.filter(row=>row.result_mode==='crossing').every(row=>row.macrogroup_filter==='')).toBe(true);
    await page.locator('#crossing-macrogroup-filter').selectOption('J');
    const bothFiltered=await checkOrder(22);
    expect(bothFiltered.filter(row=>row.result_mode==='crossing').map(row=>row.macrogroup_filter)).toEqual(['J']);
    await page.locator('#crossing-macrogroup-filter').selectOption('');
    await page.locator('#result-macrogroup-filter').selectOption('');
    await expect(formed).toHaveCount(50);
    await checkOrder(65);
  });
}
