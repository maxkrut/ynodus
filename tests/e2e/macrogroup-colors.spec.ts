import { expect, test } from '@playwright/test';
import { compact } from '../../scripts/semantic-audit/fixtures.mjs';
import { readTextContrast } from './contrast-support';
import { hierarchyMacrogroupsFixture } from '../fixtures/hierarchy-macrogroups.mjs';
import { readFile } from 'node:fs/promises';
import { parseCsv } from '../../scripts/semantic-audit/csv.mjs';

const groups = ['R1a', 'R1b', 'I1', 'I2', 'J1', 'J2'];
const data = compact(groups.map(() => -1), groups.map(() => 5500),
  groups.flatMap((_, i) => [[i, 0, 5], [i, 1, 3]]));
data.countryCodes = ['RUS', 'POL', 'FRA'];
data.projectIds = groups;
data.nodeIds = groups.map((g, i) => `${g}-SYN-COLOR-${i}`);
data.nodes.forEach((node, i) => { node[0] = i; });

for (const width of [390, 1440]) test(`chart and table share macrogroup hues at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/data/hras-index.json', route => route.fulfill({ json: data }));
  await page.goto('/?lang=ru&countries=RUS,POL&target=5500&window=300&min=0&presence=all');
  await expect(page.locator('#result-body tr[data-result-role]')).toHaveCount(6);
  await page.locator('#density-step').fill(width === 390 ? '2400' : '600');
  await page.locator('#density-step').press('Enter');
  for (const locale of ['ru', 'en']) {
    await page.locator('#locale-switcher').selectOption(locale);
    const column = page.locator('button.density-cell[data-target-ybp="5500"]');
    const chartColors = await column.evaluate(cell => {
      const labels = [...cell.querySelectorAll('.density-macro-labels .density-macro-letter')];
      const segments = [...cell.querySelectorAll('.density-macro-stack i')];
      return Object.fromEntries(labels.map((label, i) => [label.textContent!, getComputedStyle(segments[i]).backgroundColor]));
    });
    expect(Object.keys(chartColors).sort()).toEqual([...groups].sort());
    expect(chartColors.R1a).toBe('rgb(248, 118, 109)');
    for (const group of groups) {
      const row = page.locator(`#result-body tr[data-macro-group="${group}"]`);
      const marker = row.locator('.row-macro-label i');
      const label = row.locator('.row-macro-label');
      const branch = row.locator('.subclade-link');
      expect(await marker.evaluate(e => getComputedStyle(e).backgroundColor)).toBe(chartColors[group]);
      expect(await column.locator('.density-macro-letter').filter({ hasText: new RegExp(`^${group}$`) })
        .evaluate(e => getComputedStyle(e).backgroundColor)).toBe(chartColors[group]);
      expect(await label.evaluate(e => getComputedStyle(e).color)).toBe(await branch.evaluate(e => getComputedStyle(e).color));
      const contrast = await readTextContrast(branch);
      expect(contrast.ratio).toBeGreaterThanOrEqual(contrast.minimum);
    }
    await page.mouse.move(0, 0); await page.locator('#density-step').blur();
    await page.screenshot({ path: `output/macrogroup-colors/${width}-${locale}.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
});

for (const width of [390, 1440]) test(`hierarchy overrides broad and conflicting source projects at ${width}`, async ({page}) => {
  await page.setViewportSize({width,height:1000});
  const errors: string[] = []; page.on('pageerror', e=>errors.push(e.message));
  await page.route('**/data/hras-index.json', route=>route.fulfill({json:hierarchyMacrogroupsFixture()}));
  await page.goto('/?lang=ru&countries=RUS,POL&target=5500&window=0&min=0&presence=all');
  await expect(page.locator('#result-body tr[data-result-role]')).toHaveCount(8);
  await page.locator('#density-step').fill(width===390?'2400':'600'); await page.locator('#density-step').press('Enter');
  for (const locale of ['ru','en']) {
    await page.locator('#locale-switcher').selectOption(locale);
    const colors = await page.locator('button.density-cell[data-target-ybp="5500"]').evaluate(cell => {
      const labels=[...cell.querySelectorAll('.density-macro-letter')], fills=[...cell.querySelectorAll('.density-macro-stack i')];
      return Object.fromEntries(labels.map((label,i)=>[label.textContent!,getComputedStyle(fills[i]).backgroundColor]));
    });
    expect(Object.keys(colors).sort()).toEqual(['I1','I2','J1','J2','R','R1a','R1b']);
    for (const group of ['I1','I2','J1','J2','R','R1a','R1b']) {
      const rows=page.locator(`#result-body tr[data-macro-group="${group}"]`);
      for (const row of await rows.all()) {
        await expect(row.locator('.row-macro-label')).toHaveText(group);
        expect(await row.locator('.row-macro-label i').evaluate(e=>getComputedStyle(e).backgroundColor)).toBe(colors[group]);
      }
    }
    await page.locator('#result-macrogroup-filter').selectOption('R1b');
    const row=page.locator('#result-body tr[data-result-role]'); await expect(row).toHaveCount(1);
    await expect(row).toContainText('R-SYN-BROAD-B');
    const download=page.waitForEvent('download'); await page.locator('#export-csv').click();
    const file=await download, csv=parseCsv(await readFile((await file.path())!,'utf8'));
    expect(csv.length).toBe(1); expect(csv[0].macrogroup).toBe('R1b'); expect(csv[0].macrogroup_filter).toBe('R1b');
    await page.locator('#result-macrogroup-filter').selectOption('');
    await page.mouse.move(0,0);
    await page.screenshot({path:`output/macrogroup-hierarchy/${width}-${locale}.png`,fullPage:true});
  }
  await page.goto('/?lang=ru&countries=RUS,POL&target=5250&window=0&crossing=1&min=0&presence=all');
  const edge=page.locator('#crossing-result-body tr[data-result-role]'); await expect(edge).toHaveCount(1);
  await expect(edge).toHaveAttribute('data-macro-group','R1b');
  await expect(edge.locator('.table-branch-identity [data-macro-group="R1b"]')).toHaveCount(2);
  await page.goto('/?lang=ru&view=profile&clade=R-SYN-BROAD-B&countries=RUS,POL&min=0&presence=all');
  await expect(page.locator('.profile-project')).toHaveText('R1b');
  await page.goto('/?lang=ru&view=country-overview&country=RUS&countries=RUS,POL&min=0&presence=all');
  await expect(page.locator('[data-country-macrogroup="R1b"] em')).toContainText('10');
  await expect(page.locator('[data-country-macrogroup="R"] em')).toContainText('10');
  expect(await page.locator('[data-country-macrogroup="R1b"] .country-distribution-track i')
    .evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(0, 190, 108)');
  expect(errors).toEqual([]);
});
