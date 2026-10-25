import { expect, test } from '@playwright/test';
import { branchCountriesFixture, branchCountriesLargeFixture } from '../fixtures/branch-countries.mjs';
import { layoutFixture } from '../fixtures/layout.mjs';
import { expectReadableText, measureTextStates } from './contrast-support';

for (const lang of ['ru', 'en']) test(`retired presentation fields preserve the current matrix after reload in ${lang}`, async ({page}) => {
  await page.setViewportSize({width:390,height:1000});
  await page.route('**/data/hras-index.json',route=>route.fulfill({json:branchCountriesFixture()}));
  await page.goto(`/?lang=${lang}&view=profile&clade=R-SYN-ROOT&countries=RUS&min=0`);
  const root=page.locator('#profile-content'), search=root.locator('[data-profile-tree-search]');
  await search.fill('R-SYN-A');
  await root.locator('#profile-country-filter').selectOption('RUS');
  const nodes=()=>root.locator('[data-tree-node]').evaluateAll(rows=>rows.map(row=>row.getAttribute('data-tree-node')));
  const before=await nodes();expect(before.length).toBeGreaterThan(0);
  await expect.poll(()=>page.evaluate(()=>history.state?.ynodusNavigation?.snapshot?.profileExplorer?.query)).toBe('R-SYN-A');
  await page.evaluate(()=>{
    const entry=structuredClone(history.state);
    entry.ynodusNavigation.snapshot.profileExplorer.mode='tree';
    history.replaceState(entry,'');
  });
  await page.reload();
  await expect(root.locator('.tree-sheet-matrix')).toHaveCount(1);
  await expect(search).toHaveValue('R-SYN-A');
  await expect(root.locator('#profile-country-filter')).toHaveValue('RUS');
  await expect(root.locator('.matrix-country-heading .fi')).toHaveCount(3);
  expect(await nodes()).toEqual(before);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

for (const width of [390,768,1440]) test(`profile explorer selection, flags, hierarchy and returns at ${width}`, async ({page}) => {
  const errors: string[] = []; page.on('pageerror', e=>errors.push(e.message));
  await page.setViewportSize({width,height:1000});
  await page.route('**/data/hras-index.json',route=>route.fulfill({json:branchCountriesFixture()}));
  await page.goto('/?lang=ru&view=profile&clade=R-SYN-ROOT&countries=RUS&min=0');
  const root = page.locator('#profile-content');
  const inspector = root.locator('[data-profile-inspector]');
  await expect(inspector.locator('.profile-selected-metric article > strong')).toHaveText('20');
  await expect(inspector.locator('.country-evidence-row .fi')).toHaveCount(3);
  const before = page.url();
  await root.locator('[data-profile-select="R-SYN-A"]').click();
  expect(page.url()).toBe(before);
  await expect(inspector.locator('.profile-selected-summary h3')).toHaveText('R-SYN-A');
  await expect(inspector.locator('.profile-selected-metric article > strong')).toHaveText('8');
  await expect(inspector.locator('.profile-selected-direct')).toContainText('1');
  await expect(inspector.locator('.country-evidence-row .fi')).toHaveCount(2);

  await expect(root.locator('[data-profile-tree-view]')).toBeVisible();
  await expect(root.locator('.matrix-country-heading .fi')).toHaveCount(3);
  const table = root.locator('.profile-matrix');
  await expect(table.locator('tbody tr')).toHaveCount(5);
  // Root and descendants are nested. The root alone carries the whole-branch total.
  expect(await table.locator('tbody [data-branch-tree-all]').allTextContents()).toEqual(['20','10','3','8','7']);
  await table.locator('[data-country-evidence="RUS"][data-country-evidence-anchor="R-SYN-A"]').click();
  await expect(page.locator('#country-evidence-workspace')).toBeVisible();
  await page.locator('#country-evidence-workspace [data-research-back]').click();
  await expect(root.locator('.tree-sheet-matrix')).toHaveCount(1);
  await page.locator('#locale-switcher').selectOption('en');
  await expect(root.locator('[data-profile-mode]')).toHaveCount(0);
  await expect(table).toBeVisible();
  await page.reload();
  await expect(root.locator('.tree-sheet-matrix')).toHaveCount(1);

  await expect(inspector.locator('.profile-selected-summary h3')).toHaveText('R-SYN-A');
  if (width === 1440) {
    const row = root.locator('[data-tree-node="R-SYN-A1"]');
    expect((await row.boundingBox())!.height).toBeLessThanOrEqual(32);
    // The root has the same selection colours without a decorative ancestor connector.
    await root.locator('[data-profile-select="R-SYN-ROOT"]').click();
    expectReadableText(await measureTextStates(page,[
      {name:'sample type',control:root.locator('#profile-sample-scope')},
      {name:'country filter',control:root.locator('#profile-country-filter')},
      {name:'selected node',control:root.locator('[data-profile-select="R-SYN-ROOT"]')},
    ]));
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  if (width < 1440) await root.locator('[data-profile-tree-view]').screenshot({path:`output/profile-explorer/tree-${width}.png`});
  expect(errors).toEqual([]);
});

test('large profile comparison stays bounded and retains full totals', async ({page}) => {
  await page.route('**/data/hras-index.json',route=>route.fulfill({json:branchCountriesLargeFixture()}));
  await page.goto('/?lang=ru&view=profile&clade=R-SYN-ROOT&countries=RUS&min=0');

  await expect(page.locator('.profile-matrix tbody tr')).toHaveCount(21);
  await expect(page.locator('[data-tree-node="R-SYN-ROOT"] [data-branch-tree-all]')).toHaveText('183');
  await page.locator('[data-evidence-tree-more="R-SYN-ROOT"]').click();
  await expect(page.locator('.profile-matrix tbody tr')).toHaveCount(41);
  await expect(page.locator('[data-tree-node="R-SYN-ROOT"] [data-branch-tree-all]')).toHaveText('183');

  await expect(page.locator('.tree-sheet-matrix')).toHaveCount(1);
  await expect(page.locator('.tree-sheet')).toHaveCount(1);
});

test('desktop profile captures on the same comparison fixture', async ({page}) => {
  await page.setViewportSize({width:1440,height:1050});
  await page.route('**/data/hras-index.json',route=>route.fulfill({json:layoutFixture()}));
  await page.goto('/?lang=ru&view=profile&clade=R-SYN-100&countries=RUS&min=0');
  await expect(page.locator('[data-profile-inspector] .country-evidence-row .fi')).toHaveCount(12);
  await page.screenshot({path:'output/profile-explorer/tree-1440.png'});

  await page.waitForTimeout(200); // Let the shared button colour transition finish before capture.
  await page.screenshot({path:'output/profile-explorer/matrix-1440.png'});
});

test('profile uses the sample-type control without duplicate ancient notes and shows all countries', async ({page}) => {
  let data = {...branchCountriesFixture(),ancientCounts:[1,0,1,1,1,0,2]};
  await page.route('**/data/hras-index.json',route=>route.fulfill({json:data}));
  await page.goto('/?lang=ru&view=profile&clade=R-SYN-ROOT&samples=all');
  await expect(page.locator('#profile-sample-scope')).toHaveValue('all');
  await expect(page.locator('.profile-selected-metric .ancient-count-note')).toHaveCount(0);

  await expect(page.locator('.profile-matrix .ancient-count-note')).toHaveCount(0);
  await expect(page.locator('[data-tree-node="R-SYN-ROOT"] [data-branch-tree-all]')).toHaveText('20');
  const many = layoutFixture(); many.countryCodes.push('USA'); many.countryCounts.push(1); many.samples.push([2,12,1]);
  await page.unroute('**/data/hras-index.json');
  await page.route('**/data/hras-index.json',route=>route.fulfill({json:many}));
  await page.goto('/?lang=en&view=profile&clade=R-SYN-100');

  await expect(page.locator('.matrix-country-heading')).toHaveCount(13);
  await expect(page.locator('.matrix-country-heading .fi-us')).toHaveCount(1);
  await expect(page.locator('[data-tree-node="R-SYN-100"] [data-branch-tree-all]')).toHaveText('769');
  await page.reload();
  await expect(page.locator('.matrix-country-heading .fi-us')).toHaveCount(1);
});
