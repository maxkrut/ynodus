import {expect,test} from '@playwright/test';
import {countryForestFixture,countryDeepFixture} from '../fixtures/layout.mjs';
import {allResearchLevels} from './research-test-actions';
const rows=p=>p.locator('[data-country-tree-node]');
test('country matrix bounds large sibling groups and preserves search, focus and reload',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/data/hras-index.json',r=>r.fulfill({json:countryForestFixture()}));
  await page.goto('/?lang=ru&view=country-overview&country=RUS');
  await allResearchLevels(page);
  await expect(rows(page)).toHaveCount(43);
  await expect(page.locator('.country-overview-total > strong')).toHaveText('806');
  await expect(page.locator('.country-tree-section > header')).toContainText('800');
  await expect(page.locator('[data-tree-node][data-tree-parent=""]')).toHaveCount(2);
  const branch=page.locator('[data-country-tree-toggle="R-SYN-BRANCH"]');
  await branch.focus();await page.keyboard.press('Enter');
  await expect(branch).toHaveAttribute('aria-expanded','false');await expect(branch).toBeFocused();
  await expect(rows(page)).toHaveCount(23);
  await page.keyboard.press('ArrowRight');await expect(rows(page)).toHaveCount(43);
  await page.locator('[data-evidence-tree-more="R-SYN-BRANCH"]').click();
  await expect(rows(page)).toHaveCount(63);
  await page.reload();await expect(rows(page)).toHaveCount(63);
  await page.locator('[data-country-tree-search]').fill('r-syn-l599');
  await expect(rows(page)).toHaveCount(3);
  await expect(page.locator('[data-tree-node="R-SYN-L599"]')).toHaveAttribute('data-tree-parent','R-SYN-BRANCH');
  await page.locator('[data-tree-node="R-SYN-L599"] [data-open-profile-subclade]').click();
  await expect(page.locator('.profile-compact-header h3')).toHaveText('R-SYN-L599');
  await expect(page.locator('#country-overview-content')).toBeEmpty();
  await page.locator('#profile-workspace [data-research-back]').click();
  await expect(page.locator('[data-country-tree-search]')).toHaveValue('r-syn-l599');
  await expect(rows(page)).toHaveCount(3);
  await page.locator('[data-country-tree-search]').fill('NO-SYN-MATCH');
  await expect(rows(page)).toHaveCount(0);
  await page.locator('[data-country-tree-search]').fill('');
  await expect(rows(page)).toHaveCount(63);
  expect(errors).toEqual([]);
});
for(const width of [320,390,761,1440]) test('country forest reading and search at '+width,async({page})=>{
  await page.setViewportSize({width,height:1000});
  await page.route('**/data/hras-index.json',r=>r.fulfill({json:countryForestFixture()}));
  await page.goto('/?lang=ru&view=country-overview&country=RUS');
  await allResearchLevels(page);
  for(const lang of ['ru','en']){
    await page.locator('#locale-switcher').selectOption(lang);
    await page.locator('[data-country-tree-search]').fill('R-SYN-L');
    await expect(page.locator('.tree-sheet tbody tr:not(.tree-context-row)')).toHaveCount(100);
    await expect(page.locator('[data-tree-node="R-SYN-ROOT"]')).toHaveCount(1);
    await expect(page.locator('[data-tree-node="R-SYN-BRANCH"]')).toHaveCount(1);
    await page.locator('[data-evidence-tree-page="next"]').click();
    await expect(page.locator('.matrix-country-heading')).toHaveCount(1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
    await page.locator('[data-country-tree-search]').fill('');
    await expect(rows(page)).toHaveCount(43);
  }
});
test('deep country ancestry keeps real parents and horizontal scrolling inside matrix',async({page})=>{
  await page.route('**/data/hras-index.json',r=>r.fulfill({json:countryDeepFixture()}));
  await page.goto('/?lang=ru&view=country-overview&country=RUS');
  await allResearchLevels(page);
  await expect(rows(page)).toHaveCount(16);
  for(const width of [320,390,1440]){
    await page.setViewportSize({width,height:1000});
    for(const lang of ['ru','en']){
      await page.locator('#locale-switcher').selectOption(lang);
      const edges=await rows(page).evaluateAll(els=>els.map(el=>[el.getAttribute('data-tree-node'),el.getAttribute('data-tree-parent')]));
      for(let i=1;i<16;i++)expect(edges.find(row=>row[0]==='R-SYN-DEPTH-'+i)?.[1]).toBe('R-SYN-DEPTH-'+(i-1));
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
      await page.locator('.tree-sheet-scroll').evaluate(el=>el.scrollLeft=el.scrollWidth);
      await expect(page.locator('.matrix-country-heading')).toBeVisible();
    }
  }
});
