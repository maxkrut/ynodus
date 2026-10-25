import { expect, test, type Page } from '@playwright/test';
import { branchCountriesFixture, branchCountriesLargeFixture } from '../fixtures/branch-countries.mjs';
import { layoutFixture } from '../fixtures/layout.mjs';
import { expectReadableText, measureTextStates } from './contrast-support';

const url = '/?lang=ru&view=country&country=RUS&clade=R-SYN-ROOT&countries=RUS&scope=POL,RUS&min=0';
const matrix = (p: Page) => p.locator('.branch-country-matrix');
const values = async (p: Page, id: string) => matrix(p).locator(`[data-tree-node="${id}"] .tree-country-cell`).evaluateAll(cells=>cells.map(c=>Number((c as HTMLElement).dataset.count)));

test('country comparison retains the same hierarchy, scope, mode and return target', async ({page}) => {
  const errors: string[] = []; page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/data/hras-index.json',r=>r.fulfill({json:branchCountriesFixture()}));
  await page.goto(url);
  await expect(page.locator('[data-branch-tree-node="R-SYN-ROOT"]')).toBeVisible();
  await expect(page.locator('.branch-country-sidebar .fi')).toHaveCount(3);
  await page.locator('[data-evidence-tree-toggle="R-SYN-A"]').click();
  await expect(matrix(page).locator('tbody tr')).toHaveCount(4);
  expect(await values(page,'R-SYN-A')).toEqual([3,5,0]);
  expect(await values(page,'R-SYN-B')).toEqual([5,0,5]);
  expect(await values(page,'R-SYN-ROOT')).toEqual([8,7,5]);
  await matrix(page).locator('[data-tree-node="R-SYN-A"] .profile-node-links [data-country-evidence-anchor]').click();
  await expect(page).toHaveURL(/clade=R-SYN-A&/);
  expect(new URL(page.url()).searchParams.get('scope')).toBe('POL,RUS');
  await page.locator('#country-evidence-workspace [data-research-back]').click();
  await expect(matrix(page)).toBeVisible();
  await expect(matrix(page).locator('[data-tree-node="R-SYN-A"] .profile-node-links [data-country-evidence-anchor]')).toBeFocused();
  await page.reload();
  await expect(matrix(page)).toBeVisible();
  await page.locator('#locale-switcher').selectOption('en');
  await expect(page.locator('[data-branch-mode]')).toHaveCount(0);
  await expect(page.locator('[data-evidence-tree-toggle="R-SYN-A"]')).toHaveAttribute('aria-expanded','true');
  await page.locator('.branch-country-filter-drawer > summary').click();
  await page.locator('[data-branch-country-choice="POL"]').uncheck();
  await expect(page.locator('[data-branch-country-pending]')).toBeVisible();
  await expect(matrix(page).locator('[data-tree-node="R-SYN-ROOT"] [data-branch-tree-selected]')).toHaveText('15');
  await page.locator('[data-branch-country-apply]').click();
  await expect(matrix(page).locator('[data-tree-node="R-SYN-ROOT"] [data-branch-tree-selected]')).toHaveText('7');
  expect(new URL(page.url()).searchParams.get('countries')).toBe('RUS');
  expect(errors).toEqual([]);
});

test('paged branches and countries keep whole-branch totals and ancient subsets', async ({page}) => {
  let data = {...branchCountriesFixture(),ancientCounts:[1,0,1,1,1,0,2]};
  await page.route('**/data/hras-index.json',r=>r.fulfill({json:data}));
  await page.goto(url);
  await expect(matrix(page).locator('[data-tree-node="R-SYN-ROOT"] .tree-total-col .ancient-count-note')).toHaveText('из них древних - 6');
  await expect(matrix(page).locator('[data-tree-node="R-SYN-ROOT"] .tree-selected-col .ancient-count-note')).toHaveText('из них древних - 4');
  data = branchCountriesLargeFixture();
  await page.goto(url);
  await expect(matrix(page).locator('tbody tr')).toHaveCount(2);
  await page.locator('[data-tree-country-reset]').click();
  await expect(matrix(page).locator('tbody tr')).toHaveCount(21);
  await page.locator('[data-evidence-tree-more="R-SYN-ROOT"]').click();
  await expect(matrix(page).locator('tbody tr')).toHaveCount(41);
  await expect(matrix(page).locator('[data-tree-node="R-SYN-ROOT"] [data-branch-tree-all]')).toHaveText('183');
  const many = layoutFixture(); many.countryCodes.push('USA'); many.countryCounts.push(1); many.samples.push([2,12,1]);
  data = many;
  await page.goto('/?lang=ru&view=country&country=RUS&clade=R-SYN-100&scope='+many.countryCodes.join(','));
  await expect(matrix(page).locator('.matrix-country-heading')).toHaveCount(13);
  await expect(matrix(page).locator('[data-tree-node="R-SYN-100"] [data-branch-tree-all]')).toHaveText('769');
  await expect(matrix(page).locator('[data-tree-node="R-SYN-100"] [data-branch-tree-selected]')).toHaveText('769');
});

for (const width of [390,768,1440]) test(`branch sidebar and comparison reading at ${width}px`, async ({page}) => {
  await page.setViewportSize({width,height:1050});
  await page.route('**/data/hras-index.json',r=>r.fulfill({json:layoutFixture()}));
  await page.goto('/?lang=ru&view=country&country=RUS&clade=R-SYN-100&scope=POL,RUS&countries=RUS&min=0');
  await expect(page.locator('[data-branch-tree-node="R-SYN-100"]')).toBeVisible();
  expect((await page.locator('.branch-country-main').boundingBox())!.width).toBeGreaterThan(width-65);
  if (width < 1440) await page.locator('.branch-country-section').screenshot({path:`output/branch-country-comparison/tree-${width}.png`});
  else await page.screenshot({path:`output/branch-country-comparison/tree-${width}.png`});
  for (const locale of ['ru','en',]) {
    await page.locator('#locale-switcher').selectOption(locale);
    await expect(matrix(page).locator('.matrix-country-heading .fi')).toHaveCount(12);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (locale === 'ru') {
      if (width < 1440) await page.locator('.branch-country-section').screenshot({path:`output/branch-country-comparison/matrix-${width}.png`});
      else await page.screenshot({path:`output/branch-country-comparison/matrix-${width}.png`});
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  if (width === 1440) expectReadableText(await measureTextStates(page,[
    {name:'branch country filter',control:page.locator('.branch-country-filter-drawer > summary')},
    {name:'country column',control:matrix(page).locator('.matrix-country-heading').first(),text:matrix(page).locator('.matrix-country-heading .matrix-country-name').first()},
  ]));
});
