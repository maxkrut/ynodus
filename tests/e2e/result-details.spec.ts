import { expect, test } from '@playwright/test';
import { branchCountriesFixture } from '../fixtures/branch-countries.mjs';

for (const width of [390, 1440]) test(`terminal result details preserve scope and return at ${width}`, async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({width, height: 1000});
  await page.route('**/data/hras-index.json', route => route.fulfill({json: {
    ...branchCountriesFixture(), ancientCounts: [1, 0, 1, 1, 1, 0, 2],
  }}));
  await page.addInitScript(() => {
    (window as any).detailAnalyses = 0;
    const send = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function(message: any, ...args: any[]) {
      if (message.type === 'analyze') (window as any).detailAnalyses++;
      return (send as any).call(this, message, ...args);
    };
  });
  await page.goto('/?lang=ru&countries=RUS&presence=any&target=5500&window=0&min=0');
  const opener = page.locator('[data-open-result-detail="R-SYN-ROOT"]');
  await expect(opener).toBeVisible();
  const row = opener.locator('xpath=ancestor::tr');
  await expect(row.locator('.table-total strong')).toHaveText('7');
  await expect(row.locator('a.subclade-link')).toHaveCount(0);
  await expect(row.locator('.table-branch-identity')).toHaveText('R-SYN-ROOT');
  await expect(row.locator('.table-yfull-action')).toHaveText('YFull ↗');
  await expect(row.locator('.table-yfull-action')).toHaveAttribute('target', '_blank');
  await expect(row.locator('.table-yfull-action')).toHaveAttribute('href', /yfull\.com\/tree\/R-SYN-ROOT/);
  await page.locator('#result-head [data-table-sort="total"]').click();
  const rows = await page.locator('#result-body').innerText();
  const requests = await page.evaluate(() => (window as any).detailAnalyses);
  await page.mouse.move(0, 0);
  await page.keyboard.press('Escape');
  await row.screenshot({path:`output/result-details/row-${width}.png`});
  await opener.click();
  const content = page.locator('#profile-content');
  await expect(content.locator('.profile-compact-header')).toBeVisible();
  await expect(content.locator('.tree-sheet-clean')).toBeVisible();
  await expect(content.locator('[data-profile-scope-total]')).toHaveText('7');
  await expect(content.locator('#profile-sample-scope')).toBeDisabled();
  await expect(content.locator('#profile-country-filter option')).toHaveCount(2);
  await content.locator('#profile-country-filter').selectOption('RUS');
  await expect(content.locator('[data-profile-country-reset]')).toBeEnabled();
  await content.locator('[data-profile-country-reset]').click();
  await expect(content.locator('[data-profile-country-reset]')).toBeDisabled();
  await expect(content.locator('.tree-direct-label, .same-formed-marker')).toHaveCount(0);
  await expect(content.locator('.profile-scope-note')).toHaveCount(0);
  await expect(content.locator('.profile-formed-context')).toHaveCount(0);
  await expect(content.locator('.profile-selected-summary h3')).toHaveCount(0);
  await expect(content.locator('.profile-selected-metric article > strong')).toContainText('7');
  await expect(content.locator('.country-evidence-list')).toContainText('RUS');
  await expect(content.locator('.country-evidence-list')).not.toContainText('POL');
  await expect(content.locator('.profile-selected-metric .ancient-count-note')).toHaveText('из них древних - 2');
  await page.screenshot({path:`output/result-details/root-summary-${width}.png`,fullPage:true});
  await expect(page.locator('#profile-lookup')).toBeHidden();
  await expect(page.locator('.research-entrypoints button:visible')).toHaveCount(0);
  await expect(content.locator('[data-open-profile-subclade], [data-country-evidence], [data-search-profile-formed], a')).toHaveCount(0);
  await expect(content.locator('[data-profile-select="R-SYN-B"]')).toHaveCount(0);
  const url = page.url();
  await content.locator('[data-profile-select="R-SYN-A1"]').click();
  await expect(page).toHaveURL(url);
  await expect(content.locator('.profile-selected-summary h3')).toHaveText('R-SYN-A1');
  await expect(content.locator('.profile-selected-metric article > strong')).toContainText('4');
  await expect(content.locator('.country-evidence-row')).toHaveCount(1);
  await page.screenshot({path:`output/result-details/detail-${width}.png`,fullPage:true});
  await content.locator('[data-profile-select="R-SYN-ROOT"]').click();
  await expect(content.locator('.profile-selected-summary h3')).toHaveCount(0);
  await expect(content.locator('.profile-selected-metric article > strong')).toContainText('7');

  await expect(content.locator('[data-tree-node="R-SYN-ROOT"] .tree-total-col')).toContainText('7');
  await expect(content.locator('.profile-matrix [data-country-evidence], .profile-matrix [data-open-profile-subclade]')).toHaveCount(0);
  for (const locale of ['en','ru']) {
    await page.locator('#locale-switcher').selectOption(locale);
    await expect(content.locator('[data-tree-node="R-SYN-ROOT"] .tree-total-col')).toContainText('7');
    await expect(page.locator('#profile-lookup')).toBeHidden();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  await page.locator('#profile-workspace [data-research-back]').click();
  await expect(page.locator('#time-workspace')).toBeVisible();
  await expect(opener).toBeFocused();
  expect(await page.locator('#result-body').innerText()).toEqual(rows);
  expect(await page.evaluate(() => (window as any).detailAnalyses)).toBe(requests);
  await page.goForward();
  await expect(content.locator('.tree-sheet-matrix')).toHaveCount(1);
  await page.reload();
  await expect(content.locator('.profile-matrix')).toContainText('RUS');
  await expect(content.locator('[data-tree-node="R-SYN-ROOT"] .tree-total-col')).toContainText('7');
  await expect(page.locator('#profile-lookup')).toBeHidden();
  await page.locator('#profile-workspace [data-research-back]').click();
  await expect(page.locator('#time-workspace')).toBeVisible();
  await page.locator('[data-research-view="profile"]').click();
  await expect(page.locator('#profile-lookup')).toBeVisible();
  await page.locator('#profile-clade-search').fill('R-SYN-ROOT');
  await page.locator('#profile-lookup button[type="submit"]').click();
  await expect(content.locator('.profile-selected-metric article > strong')).toContainText('20');
  expect(errors).toEqual([]);
});

test('Crossing opens only the child evidence and preserves both explicit YFull actions', async ({page}) => {
  await page.route('**/data/hras-index.json',route=>route.fulfill({json:branchCountriesFixture()}));
  await page.goto('/?lang=ru&countries=RUS&presence=any&target=5250&window=0&crossing=1&min=0');
  const row=page.locator('#crossing-result-body tr[data-result-role]').first();
  await expect(row.locator('.table-total strong')).toHaveText('5');
  await expect(row.locator('.table-yfull-action')).toHaveCount(2);
  await row.locator('[data-open-result-detail]').click();
  await expect(page.locator('#profile-content h3').first()).toHaveText('R-SYN-ROOT → R-SYN-A');
  await expect(page.locator('#profile-content .profile-ancestry')).toHaveCount(0);
  await expect(page.locator('.profile-selected-metric article > strong')).toHaveText('5');
  await expect(page.locator('[data-profile-select="R-SYN-ROOT"]')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.profile-selected-metric article > strong')).toHaveText('5');
  await expect(page.locator('#profile-content h3').first()).toHaveText('R-SYN-ROOT → R-SYN-A');
});

for (const [scope, total] of [['ancient','2'], ['modern','5']]) test(`details retain ${scope} sample scope`, async ({page}) => {
  await page.route('**/data/hras-index.json',route=>route.fulfill({json:{
    ...branchCountriesFixture(),ancientCounts:[1,0,1,1,1,0,2],
  }}));
  await page.goto(`/?lang=ru&countries=RUS&presence=any&target=5500&window=0&samples=${scope}`);
  await expect(page.locator('#result-body .table-total strong')).toHaveText(total);
  await page.locator('[data-open-result-detail]').click();
  await expect(page.locator('.profile-selected-metric article > strong')).toHaveText(total);
  await expect(page.locator('.profile-selected-metric .ancient-count-note')).toHaveCount(0);
});

test('long Formed and Crossing identifiers keep separate actions inside narrow layouts', async ({page}) => {
  const data = branchCountriesFixture();
  data.nodeIds[0] = 'R-SYN-' + 'ROOT'.repeat(20);
  data.nodeIds[1] = 'R-SYN-' + 'CHILD'.repeat(16);
  await page.route('**/data/hras-index.json',route=>route.fulfill({json:data}));
  for (const [target, crossing, body] of [['5500','0','#result-body'],['5250','1','#crossing-result-body']]) {
    await page.goto(`/?lang=ru&countries=RUS&presence=any&target=${target}&window=0&crossing=${crossing}&min=0`);
    const row = page.locator(`${body} tr[data-result-role]`).first();
    await expect(row).toBeVisible();
    for (const width of [340, 760, 761, 1050]) {
      await page.setViewportSize({width,height:900});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const actions = row.locator('.table-result-actions');
      const box = (await actions.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      if (width <= 760) {
        const scale = await page.evaluate(() => Number(getComputedStyle(document.documentElement).zoom));
        for (const button of await actions.locator('button, a').all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44 * scale - .1);
      }
    }
  }
});
