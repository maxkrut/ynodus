import { expect, test } from '@playwright/test';
import { branchCountriesFixture } from '../fixtures/branch-countries.mjs';
import { compact } from '../../scripts/semantic-audit/fixtures.mjs';
import { expectReadableText, measureTextStates } from './contrast-support';
import { allResearchLevels } from './research-test-actions';

const base = '/?lang=ru&countries=RUS&min=0&presence=any';
const parents = { 'R-SYN-ROOT': '', 'R-SYN-A': 'R-SYN-ROOT', 'R-SYN-A1': 'R-SYN-A', 'R-SYN-B': 'R-SYN-ROOT', 'R-SYN-B1': 'R-SYN-B' };
const rowIds = (page) => page.locator('.tree-sheet [data-tree-node]').evaluateAll(rows => rows.map(row => row.getAttribute('data-tree-node')));
async function checkEdges(page) {
  const rows = await page.locator('.tree-sheet [data-tree-node]').evaluateAll(rows => rows.map(row => ({ id: row.getAttribute('data-tree-node'), parent: row.getAttribute('data-tree-parent') })));
  for (const row of rows) {
    expect(row.parent).toBe(parents[row.id]);
    if (row.parent) expect(rows.some(other => other.id === row.parent)).toBe(true);
  }
}
for (const width of [390, 1440]) test(`same hierarchy and country filters in both views at ${width}`, async ({ page }) => {
  const data = { ...branchCountriesFixture(), ancientCounts: [1, 0, 1, 1, 1, 0, 2] };
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width, height: 1100 });
  await page.route('**/data/hras-index.json', route => route.fulfill({ json: data }));
  await page.goto(`${base}&view=profile&clade=R-SYN-ROOT`);
  await allResearchLevels(page);
  await expect(page.locator('.tree-sheet [data-tree-node]')).toHaveCount(5);
  const initial = await rowIds(page); await checkEdges(page);
  await expect(page.locator('[data-profile-mode]')).toHaveCount(0);
  expect(await rowIds(page)).toEqual(initial);
  await expect(page.locator('.matrix-country-heading .flag')).toHaveCount(3);
  const header = page.locator('[data-tree-country="RUS"]');
  expect(await header.locator('.matrix-country-name').evaluate(el => getComputedStyle(el).writingMode)).toBe('vertical-rl');
  await header.click();
  await expect(header).toHaveAttribute('aria-pressed', 'true');
  expect(await rowIds(page)).toEqual(['R-SYN-ROOT', 'R-SYN-A', 'R-SYN-A1']); await checkEdges(page);
  await expect(page.locator('[data-tree-node="R-SYN-ROOT"] [data-branch-tree-all]')).toHaveText('20');
  await expect(page.locator('[data-tree-node="R-SYN-ROOT"] [data-branch-tree-selected]')).toHaveText('7');
  await expect(page.locator('.tree-sheet .tree-cell-ancient')).toHaveCount(0);
  if (width === 1440) expectReadableText(await measureTextStates(page, [{ name: 'inactive country count', control: page.locator('[data-tree-node="R-SYN-ROOT"] .is-muted button').first() }]));
  await page.locator('[data-evidence-tree-toggle="R-SYN-A"]').click();
  expect(await rowIds(page)).toEqual(['R-SYN-ROOT', 'R-SYN-A']);
  expect(await rowIds(page)).toEqual(['R-SYN-ROOT', 'R-SYN-A']);

  await page.locator('#locale-switcher').selectOption('en');
  await expect(page.locator('[data-tree-country="RUS"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-evidence-tree-toggle="R-SYN-A"]')).toHaveAttribute('aria-expanded', 'false');
  await page.locator('[data-evidence-tree-toggle="R-SYN-A"]').focus(); await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-tree-node="R-SYN-A1"]')).toBeVisible();
  await page.locator('[data-tree-country="POL"]').click();
  expect(await rowIds(page)).toEqual(['R-SYN-ROOT', 'R-SYN-B', 'R-SYN-A', 'R-SYN-A1']); await checkEdges(page);
  await page.locator('[data-open-profile-subclade="R-SYN-A"]').click();
  await expect(page.locator('#profile-content h3').first()).toHaveText('R-SYN-A');
  await page.locator('#profile-workspace [data-research-back]').click();
  await expect(page.locator('.tree-sheet-matrix')).toHaveCount(1);
  await expect(page.locator('[data-tree-country="RUS"]')).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await expect(page.locator('[data-tree-country="POL"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-tree-country-reset]').click();
  await expect(page.locator('.tree-sheet [data-tree-node]')).toHaveCount(5);
  for (const code of ['RUS','POL','FRA']) await page.locator(`[data-tree-country="${code}"]`).click();
  await expect(page.locator('[data-tree-country][aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator('[data-tree-country="FRA"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('[data-tree-country="FRA"]').click();
  expect(await rowIds(page)).toEqual(['R-SYN-ROOT','R-SYN-B','R-SYN-B1']);
  await page.locator('[data-tree-country-reset]').click();
  const box = (await page.locator('.tree-sheet-scroll').boundingBox())!;
  expect(box.width).toBeGreaterThan(width - 65);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const scale = await page.evaluate(() => Number(getComputedStyle(document.documentElement).zoom));
  expect((await page.locator('.tree-country-col').first().boundingBox())!.width).toBeLessThan(60 * scale);
  await page.mouse.move(0, 0);
  await page.locator('.tree-sheet-scroll').screenshot({ path: `output/tree-sheet/profile-${width}-en.png` });
  await page.locator('#locale-switcher').selectOption('ru');
  await page.locator('.tree-sheet-scroll').screenshot({ path: `output/tree-sheet/profile-${width}-ru.png` });
  expect(new URL(page.url()).searchParams.get('countries')).toBe('RUS');
  expect(errors).toEqual([]);
});

for (const width of [390, 1440]) test(`branch country view shares expansion and immediate filters at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1100 });
  await page.route('**/data/hras-index.json', route => route.fulfill({ json: branchCountriesFixture() }));
  await page.goto(`${base}&view=country&country=RUS&clade=R-SYN-ROOT&scope=RUS`);
  await expect(page.locator('.tree-sheet [data-tree-node]')).toHaveCount(2);
  await page.locator('[data-evidence-tree-toggle="R-SYN-A"]').click();
  const before = await rowIds(page);
  expect(await rowIds(page)).toEqual(before);
  await page.locator('[data-tree-country="FRA"]').click();
  await expect(page.locator('[data-tree-node="R-SYN-B"]')).toBeVisible();
  await expect(page.locator('[data-tree-node="R-SYN-ROOT"] [data-branch-tree-selected]')).toHaveText('12');
  await page.locator('[data-evidence-tree-toggle="R-SYN-B"]').click();
  await expect(page.locator('[data-tree-node="R-SYN-B1"]')).toBeVisible(); await checkEdges(page);

  await expect(page.locator('[data-tree-node="R-SYN-B1"]')).toBeVisible();

  await page.locator('[data-tree-country-reset]').click();
  await expect(page.locator('[data-tree-node="R-SYN-ROOT"] [data-branch-tree-selected]')).toHaveText('20');
  await expect(page.locator('.matrix-country-heading .flag')).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.branch-country-main').screenshot({ path: `output/tree-sheet/branch-${width}.png` });
  expect(new URL(page.url()).searchParams.get('countries')).toBe('RUS');
});

test('paged tree keeps real ancestor rows and all countries', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  const parents = [-1], ages = [6000], ids = ['R-SYN-ROOT'], samples: number[][] = [];
  for (let i = 1; i <= 145; i++) { parents.push(i - 1); ages.push(6000 - i); ids.push(`R-SYN-D${i}`); }
  for (let country = 0; country < 14; country++) samples.push([145, country, country + 1]);
  const data = compact(parents, ages, samples); data.nodeIds = ids;
  data.countryCodes = ['RUS','POL','FRA','DEU','FIN','GBR','UKR','AUT','ESP','ITA','CZE','SVK','HRV','SRB'];
  data.countryCounts = data.countryCodes.map((_, i) => i + 1);
  await page.route('**/data/hras-index.json', route => route.fulfill({ json: data }));
  await page.goto(`${base}&view=profile&clade=R-SYN-ROOT`);
  await allResearchLevels(page);
  await expect(page.locator('.tree-sheet [data-tree-node]')).toHaveCount(100);
  await page.locator('[data-evidence-tree-page="next"]').click();
  await expect(page.locator('[data-tree-node="R-SYN-D145"]')).toBeVisible();
  const firstBounds = await page.locator('.tree-sheet tbody tr:not(.tree-context-row)').first().boundingBox();
  const paneBounds = await page.locator('.tree-sheet-scroll').boundingBox();
  expect(firstBounds!.y).toBeGreaterThanOrEqual(paneBounds!.y);
  expect(firstBounds!.y + firstBounds!.height).toBeLessThanOrEqual(paneBounds!.y + paneBounds!.height);
  const hierarchy = await page.locator('[data-tree-node]').evaluateAll(rows => rows.map(row => ({ id: row.getAttribute('data-tree-node'), parent: row.getAttribute('data-tree-parent') })));
  for (const row of hierarchy) if (row.parent) expect(hierarchy.some(other => other.id === row.parent)).toBe(true);

  await expect(page.locator('.matrix-country-heading')).toHaveCount(14);
  await expect(page.locator('[data-tree-node="R-SYN-D145"]')).toBeVisible();
  await expect(page.locator('[data-tree-node="R-SYN-D145"]')).toHaveAttribute('data-tree-parent','R-SYN-D144');
  await expect(page.locator('[data-tree-node="R-SYN-D145"] .tree-sheet-identity')).toHaveCSS('padding-left','2900px');
  await expect(page.locator('.tree-node-col > small')).toHaveCount(0);
  const pane = page.locator('.tree-sheet-scroll');
  await pane.evaluate(el => { el.scrollLeft = el.scrollWidth; });
  await expect.poll(() => pane.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  await page.locator('[data-tree-country="RUS"]').click();
  await expect.poll(() => pane.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);


  await expect.poll(() => pane.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
