import { expect, test, type Page } from '@playwright/test';
import { branchCountriesFixture, branchCountriesLargeFixture } from '../fixtures/branch-countries.mjs';

const url = '/?view=country&country=RUS&clade=R-SYN-ROOT&lang=ru&countries=RUS&presence=any&target=5500&window=100&min=0';
const row = (page: Page, id: string) => page.locator(`[data-branch-tree-node="${id}"]`);
async function start(page: Page, fixture = branchCountriesFixture(), suffix = '') {
  await page.addInitScript(() => {
    (window as any).branchAnalyses = 0;
    const send = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function(message: any, ...args: any[]) {
      if (message?.type === 'analyze') (window as any).branchAnalyses++;
      return (send as any).call(this, message, ...args);
    };
  });
  await page.route('**/data/hras-index.json', route => route.fulfill({ json: fixture }));
  await page.goto(url + suffix);
  await expect(row(page, 'R-SYN-ROOT')).toBeVisible();
  await expect(page.locator('#export-csv')).toBeEnabled();
}
async function count(page: Page, id: string, all: number, selected: number) {
  await expect(row(page, id).locator('[data-branch-tree-all]')).toHaveText(String(all));
  await expect(row(page, id).locator('[data-branch-tree-selected]')).toHaveText(String(selected));
}
async function addPoland(page: Page) {
  await page.locator('.branch-country-filter-drawer > summary').click();
  await page.locator('[data-branch-country-choice="POL"]').check();
  await page.locator('[data-branch-country-apply]').click();
}

test('all and selected counts remain nested, and filtering hides unsupported branches', async ({ page }) => {
  await start(page);
  const analyses = await page.evaluate(() => (window as any).branchAnalyses);
  await count(page, 'R-SYN-ROOT', 20, 7); await count(page, 'R-SYN-A', 8, 5); await expect(row(page, 'R-SYN-B')).toHaveCount(0);
  await expect(page.locator('[data-branch-scope-selected]')).toHaveText('7 образцов');
  await expect(page.locator('#branch-country-selector')).toHaveText('Выбрано 1 из 3 стран в ветви');
  await expect(row(page, 'R-SYN-A1')).toHaveCount(0);
  await expect(row(page, 'R-SYN-B').locator('[data-evidence-tree-toggle]')).toHaveCount(0);
  await page.locator('[data-evidence-tree-toggle="R-SYN-A"]').click(); await count(page, 'R-SYN-A1', 7, 4);
  await addPoland(page); await count(page, 'R-SYN-ROOT', 20, 15); await count(page, 'R-SYN-A', 8, 8); await count(page, 'R-SYN-B', 10, 5);
  await expect(page.locator('[data-branch-scope-selected]')).toHaveText('15 образцов');
  await expect(page.locator('#branch-country-selector')).toHaveText('Выбрано 2 из 3 стран в ветви');
  await expect(row(page, 'R-SYN-B1')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).branchAnalyses)).toBe(analyses);
  expect(new URL(page.url()).searchParams.get('countries')).toBe('RUS');
  expect(new URL(page.url()).searchParams.get('scope')?.split(',').sort()).toEqual(['POL','RUS']);
  await page.locator('.branch-country-filter-drawer > summary').click();
  await page.locator('[data-branch-country-choice="POL"]').uncheck(); await page.locator('[data-branch-country-choice="RUS"]').uncheck();
  await expect(page.locator('[data-branch-country-apply]')).toBeDisabled();
});

test('selection, tree search, expansion and opener survive profiles, tabs, Back/Forward and reload', async ({ page }) => {
  await start(page); await addPoland(page);
  await page.locator('[data-evidence-tree-toggle="R-SYN-A"]').click();
  await page.locator('[data-branch-tree-search]').fill('R-SYN-A1');
  await expect(row(page,'R-SYN-A1')).toHaveAttribute('data-tree-parent','R-SYN-A');
  await expect(row(page,'R-SYN-A')).toHaveAttribute('data-tree-parent','R-SYN-ROOT');
  const opener = row(page, 'R-SYN-A1').locator('.tree-node-col [data-country-evidence-anchor]');
  await opener.click(); await expect(page).toHaveURL(/clade=R-SYN-A1/);
  await page.locator('#country-evidence-workspace [data-research-back]').click();
  await expect(page.locator('[data-branch-tree-search]')).toHaveValue('R-SYN-A1'); await expect(opener).toBeFocused();
  await page.locator('[data-branch-tree-search]').fill('');
  await page.locator('#country-evidence-content [data-open-profile-subclade="R-SYN-ROOT"]').click();
  await expect(page.locator('#profile-content h3').first()).toHaveText('R-SYN-ROOT');
  await expect(page.locator('#profile-workspace [data-research-back]')).toContainText('POL + RUS');
  await page.locator('#profile-workspace [data-research-back]').click(); await count(page, 'R-SYN-ROOT', 20, 15);
  await expect(page.locator('[data-evidence-tree-toggle="R-SYN-A"]')).toHaveAttribute('aria-expanded', 'true');
  await page.locator('[data-research-view="time"]').click();
  await page.locator('[data-research-view="profile"]').click(); await count(page, 'R-SYN-ROOT', 20, 15);
  await page.goBack(); await expect(page.locator('#time-workspace')).toBeVisible();
  await page.goForward(); await count(page, 'R-SYN-ROOT', 20, 15);
  await page.reload(); await count(page, 'R-SYN-ROOT', 20, 15);
});

test('large siblings are bounded and search covers unseen supported nodes', async ({ page }) => {
  await start(page, branchCountriesLargeFixture());
  await count(page, 'R-SYN-ROOT', 183, 3);
  const nodes = page.locator('[data-branch-tree-node]');
  await expect(nodes).toHaveCount(2); await expect(nodes.nth(1)).toHaveAttribute('data-branch-tree-node', 'R-SYN-SELECTED');
  await page.locator('[data-tree-country-reset]').click();
  await expect(nodes).toHaveCount(21);
  await page.locator('[data-evidence-tree-more="R-SYN-ROOT"]').click(); await expect(nodes).toHaveCount(41);
  await page.locator('[data-branch-tree-search]').fill('R-SYN-ZERO-59');
  await count(page, 'R-SYN-ZERO-59', 3, 3); await expect(row(page,'R-SYN-ZERO-59')).toHaveAttribute('data-tree-parent','R-SYN-ROOT');
});

for (const width of [390, 1440]) test(`annotations and identity remain readable in both locales at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 }); await start(page);
  for (const locale of ['ru', 'en',]) {
    await page.locator('#locale-switcher').selectOption(locale);
    await expect(page.locator('.methodology-card')).toHaveCount(0);
    const scope = page.locator('.country-identity-name [data-annotation="sample-countries"]');
    await scope.click(); await expect(page.locator('#context-annotation')).toBeVisible(); await page.keyboard.press('Escape');
    await page.locator('.branch-country-filter-drawer > summary').click();
    const geometry = await page.evaluate(() => ({ width: innerWidth, doc: document.documentElement.scrollWidth,
      mids: [...document.querySelectorAll('.country-evidence-identity .profile-identity-main > *')].map(e => { const r = e.getBoundingClientRect(); return r.top + r.height / 2; }),
      counts: [...document.querySelectorAll('.branch-country-ledger article > strong')].map(e => e.getBoundingClientRect().top),
      labels: [...document.querySelectorAll('.branch-country-ledger .annotated-label, .branch-tree-columns .annotated-label')].map(e => {
        const text = e.querySelector('span')!.getBoundingClientRect(), button = e.querySelector('button')!.getBoundingClientRect();
        return Math.abs(text.top + text.height / 2 - button.top - button.height / 2);
      }) }));
    expect(geometry.doc).toBeLessThanOrEqual(geometry.width + 1);
    if (width > 760) expect(Math.abs(geometry.mids[0] - geometry.mids[1])).toBeLessThan(2);
    else expect(Math.abs(geometry.counts[0] - geometry.counts[1])).toBeLessThan(1);
    for (const offset of geometry.labels) expect(offset).toBeLessThan(1);
  }
});
