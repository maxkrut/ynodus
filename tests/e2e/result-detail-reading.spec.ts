import { expect, test, type Page } from '@playwright/test';
import { layoutFixture } from '../fixtures/layout.mjs';
import { branchCountriesFixture } from '../fixtures/branch-countries.mjs';
import { compact } from '../../scripts/semantic-audit/fixtures.mjs';

async function openResult(page: Page, data: ReturnType<typeof layoutFixture>, target: number, id: string) {
  await page.route('**/data/hras-index.json', route => route.fulfill({ json: data }));
  await page.goto(`/?lang=ru&countries=${data.countryCodes.join(',')}&presence=any&target=${target}&window=0&min=0`);
  await page.locator(`[data-open-result-detail="${id}"]`).click();
  await expect(page.locator('#profile-content .profile-compact-identity > h3')).toHaveText(id);
}

for (const width of [390, 768, 1440]) test(`compact result header and local inspector persist at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    (window as any).readingAnalyses = 0;
    const send = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (message: any, ...args: any[]) {
      if (message.type === 'analyze') (window as any).readingAnalyses++;
      return (send as any).call(this, message, ...args);
    };
  });
  await openResult(page, layoutFixture(), 18000, 'R-SYN-ROOT');
  const content = page.locator('#profile-content');
  const inspector = content.locator('[data-profile-inspector]');
  const outer = content.locator('[data-profile-inspector-disclosure]');
  const disclosure = inspector.locator('[data-profile-countries]');
  const originalCount = Number((await content.locator('[data-profile-scope-total]').innerText()).replace(/\D/g, ''));
  const analyses = await page.evaluate(() => (window as any).readingAnalyses);
  await expect(outer).not.toHaveAttribute('open', '');
  await expect(content.locator('.profile-country-chip')).toHaveCount(6);
  for (const locale of ['ru', 'en']) {
    const formattedCount = new Intl.NumberFormat(locale).format(originalCount);
    await page.locator('#locale-switcher').selectOption(locale);
    await expect(content.locator('[data-profile-scope-total]')).toHaveText(formattedCount);
    await expect(content.locator('.profile-ancestry, .profile-tree-section [data-tree-age-pairs], .result-detail-age-coverage')).toHaveCount(0);
    await expect(content.locator('[data-profile-extra="details"]')).not.toHaveAttribute('open', '');
    await expect(content.locator('[data-tree-age-pairs]')).toBeHidden();
    const geometry = await content.evaluate(el => {
      const header = el.querySelector('.profile-compact-header')!.getBoundingClientRect();
      const controls = el.querySelector('.profile-compact-controls')!.getBoundingClientRect();
      const tree = el.querySelector('.profile-tree-section')!.getBoundingClientRect();
      const matrix = el.querySelector('.tree-sheet-scroll')!.getBoundingClientRect();
      return { controlsInHeader: controls.bottom <= header.bottom + 1, headerBeforeTree: header.bottom < tree.top,
        fullWidth: Math.abs(matrix.width - el.getBoundingClientRect().width),
        overflow: document.documentElement.scrollWidth - innerWidth };
    });
    expect(geometry.controlsInHeader).toBe(true);
    expect(geometry.headerBeforeTree).toBe(true);
    expect(geometry.fullWidth).toBeLessThanOrEqual(1);
    expect(geometry.overflow).toBeLessThanOrEqual(0);
    if (locale === 'ru') await content.screenshot({ path: `output/result-details/reading-${width}.png` });
    await outer.locator('> summary').press('Enter');
    await expect(inspector).toBeVisible();
    await expect(disclosure).not.toHaveAttribute('open', '');
    await expect(disclosure.locator('.result-country-preview .fi')).toHaveCount(3);
    await disclosure.locator('summary').press('Enter');
    await expect(disclosure.locator('.country-evidence-row:visible')).toHaveCount(12);
    await disclosure.locator('[data-profile-country-search]').fill('RUS');
    await expect(disclosure.locator('.country-evidence-row:visible')).toHaveCount(1);
    await disclosure.locator('[data-profile-country-search]').fill('');
    await content.locator('[data-profile-select="R-SYN-100"]').click();
    await expect(inspector.locator('h3').first()).toHaveText('R-SYN-100');
    await expect(disclosure).not.toHaveAttribute('open', '');
    await content.locator('[data-profile-select="R-SYN-ROOT"]').click();
    await expect(inspector.locator('.profile-selected-metric article > strong')).toHaveText(formattedCount);
    await outer.locator('> summary').click();
    expect(await page.evaluate(() => (window as any).readingAnalyses)).toBe(analyses);
  }
  await outer.locator('> summary').click();
  await disclosure.locator('summary').click();
  await page.locator('#locale-switcher').selectOption('ru');
  await expect(outer).toHaveAttribute('open', '');
  await expect(disclosure).toHaveAttribute('open', '');
  await page.reload();
  await expect(outer).toHaveAttribute('open', '');
  await expect(disclosure).toHaveAttribute('open', '');
  await expect(content.locator('[data-profile-scope-total]')).toHaveText(new Intl.NumberFormat('ru').format(originalCount));
  expect(errors).toEqual([]);
});

test('details keep real ancestry and unknown source ages in the shared matrix', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openResult(page, branchCountriesFixture(), 5500, 'R-SYN-ROOT');
  const unknown = page.locator('[data-tree-node="R-SYN-B"]');
  await expect(unknown).toHaveAttribute('data-tree-parent', 'R-SYN-ROOT');
  await expect(unknown.locator('.tree-age-col')).toHaveText('оценка времени формирования отсутствует');
  await page.locator('[data-research-back]:visible').click();
  await page.locator('#target-year').fill('3051');
  await page.locator('#target-year').press('Tab');
  await page.locator('[data-open-result-detail="R-SYN-A"]').click();
  await expect(page.locator('.profile-compact-path')).toContainText('R-SYN-ROOT');
  await expect(page.locator('.profile-compact-path')).toContainText('R-SYN-A');
  await expect(page.locator('#profile-content a')).toHaveCount(0);
});

test('equal-age structure is available on demand without duplicate tree labels', async ({ page }) => {
  const data = branchCountriesFixture();
  data.nodes[1][2] = 5500;
  await openResult(page, data, 5500, 'R-SYN-ROOT');
  const groups = page.locator('.profile-extra').filter({ has: page.locator('.profile-formed-context') });
  await expect(groups).not.toHaveAttribute('open', '');
  await expect(page.locator('.profile-formed-context')).toBeHidden();
  await groups.locator('> summary').click();
  await expect(page.locator('.profile-same-formed-members')).toContainText('R-SYN-A');
  await expect(page.locator('[data-tree-node="R-SYN-A"]')).toHaveAttribute('data-tree-parent', 'R-SYN-ROOT');
  await expect(page.locator('.tree-direct-label, .same-formed-marker')).toHaveCount(0);
});

test('detail filters describe the active subset and never inspect an excluded node', async ({ page }) => {
  await openResult(page, branchCountriesFixture(), 5500, 'R-SYN-ROOT');
  const root = page.locator('#profile-content');
  const total = root.locator('[data-profile-scope-total]');
  const select = root.locator('[data-profile-country-filter]');
  const inspector = root.locator('[data-profile-inspector]');
  await root.locator('[data-profile-select="R-SYN-B1"]').click();
  await expect(inspector.locator('h3').first()).toHaveText('R-SYN-B1');
  await root.locator('[data-profile-country="RUS"]').click();
  await expect(select).toHaveValue('RUS');
  await expect(total).toHaveText('7');
  await expect(root.locator('[data-tree-node="R-SYN-B1"]')).toHaveCount(0);
  await expect(inspector.locator('.profile-selected-summary h3')).toHaveCount(0);
  await root.locator('[data-profile-country="POL"]').click();
  await expect(total).toHaveText('15');
  await expect(select.locator('option:checked')).not.toHaveText('Все страны');
  await page.locator('#locale-switcher').selectOption('en');
  await expect(select.locator('option:checked')).not.toHaveText('All countries');
  await page.reload();
  await expect(total).toHaveText('15');
  await expect(select.locator('option:checked')).not.toHaveText('All countries');
  await root.locator('[data-profile-country="FRA"]').click();
  await expect(total).toHaveText('20');
  await expect(root.locator('.matrix-country-heading[aria-pressed="true"]')).toHaveCount(3);
  await root.locator('[data-profile-country="RUS"]').click();
  await expect(total).toHaveText('13');
  await expect(root.locator('[data-profile-country="RUS"]')).toHaveAttribute('aria-pressed', 'false');
  await root.locator('[data-profile-country-reset]').click();
  await expect(total).toHaveText('20');
  await expect(root.locator('[data-tree-node]')).toHaveCount(5);
  await expect(select).toHaveValue('');
});

test('show more Formed events keeps the disclosure open and its focus recoverable', async ({ page }) => {
  const data = compact([-1, ...Array(82).fill(0)], [5500, ...Array.from({length:82}, (_,i)=>5501+i)],
    Array.from({length:82},(_,i)=>[i+1,0,1]));
  data.countryCodes=['RUS','POL','FRA'];
  await page.route('**/data/hras-index.json', route=>route.fulfill({json:data}));
  await page.goto('/?lang=ru&countries=RUS&presence=any&target=5500&window=100&min=0');
  await page.locator('[data-open-result-detail="SYN-000"]').click();
  const groups=page.locator('[data-profile-extra="formed"]');
  await groups.locator('> summary').click();
  await expect(groups.locator('.profile-formed-group')).toHaveCount(80);
  await groups.locator('[data-reveal-evidence="profile-formed"]').click();
  await expect(groups).toHaveAttribute('open','');
  await expect(groups.locator('.profile-formed-group')).toHaveCount(83);
  await expect(groups.locator('[data-evidence-progress="profile-formed"]')).toBeFocused();
  expect(await page.evaluate(()=>history.state.ynodusNavigation.snapshot.reveals['profile-formed'])).toBe(160);
  await page.locator('#locale-switcher').selectOption('en');
  await expect(groups).toHaveAttribute('open','');
  await expect(groups.locator('.profile-formed-group')).toHaveCount(83);
  await page.reload();
  await expect(groups).toHaveAttribute('open','');
  await expect(groups.locator('.profile-formed-group')).toHaveCount(83);
  await expect(page.locator('[data-profile-extra="details"]')).not.toHaveAttribute('open','');
});
