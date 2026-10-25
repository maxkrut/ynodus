import {expect,test} from '@playwright/test';
import {countryForestFixture} from '../fixtures/layout.mjs';
import {branchCountriesFixture} from '../fixtures/branch-countries.mjs';
for(const width of [390,768,1440]) test('country compact header and full-width matrix at '+width,async({page})=>{
  await page.setViewportSize({width,height:1050});
  await page.route('**/data/hras-index.json',r=>r.fulfill({json:branchCountriesFixture()}));
  await page.goto('/?lang=ru&view=country-overview&country=RUS&scope=FRA,POL,RUS&countries=RUS&min=0');
  await expect(page.locator('[data-country-tree-node]')).toHaveCount(5);
  for(const lang of ['ru','en']){
    await page.locator('#locale-switcher').selectOption(lang);
    const boxes=await page.evaluate(()=>{const content=document.querySelector('#country-overview-content')!.getBoundingClientRect(),tree=document.querySelector('.tree-sheet-scroll')!.getBoundingClientRect(),header=document.querySelector('.profile-compact-header')!.getBoundingClientRect();return {overflow:document.documentElement.scrollWidth-innerWidth,content:content.width,tree:tree.width,headerBottom:header.bottom,treeTop:tree.top};});
    expect(boxes.overflow).toBe(0);expect(Math.abs(boxes.content-boxes.tree)).toBeLessThanOrEqual(1);expect(boxes.treeTop).toBeGreaterThan(boxes.headerBottom);
    for(const key of ['country-overview-total','country-assignments']){
      await page.locator('[data-annotation="'+key+'"]').click();await expect(page.locator('#context-annotation')).toBeVisible();await page.keyboard.press('Escape');
    }
    await page.locator('#country-overview-content').screenshot({path:'output/country-overview-reading/unified-'+width+'-'+lang+'.png'});
  }
});
test('country summary and macrogroup bars form a disjoint partition',async({page})=>{
  const data=countryForestFixture();data.ancientCounts=data.samples.map((_,i)=>i===0||i===data.samples.length-1?1:0);
  await page.route('**/data/hras-index.json',r=>r.fulfill({json:data}));
  await page.goto('/?lang=ru&view=country-overview&country=RUS');
  await expect(page.locator('.country-overview-total > strong')).toHaveText('806');
  await expect(page.locator('.country-overview-total .ancient-count-note,.tree-cell-ancient')).toHaveCount(0);
  await page.locator('.country-macrogroup-disclosure > summary').click();
  const bars=await page.locator('[data-country-macrogroup]').evaluateAll(rows=>rows.map(row=>({count:Number(row.querySelector('em')!.textContent),fill:row.querySelector('i')!.getBoundingClientRect().width,track:row.querySelector('.country-distribution-track')!.getBoundingClientRect().width})));
  expect(bars.map(bar=>bar.count)).toEqual([608,198]);expect(bars.reduce((sum,bar)=>sum+bar.count,0)).toBe(806);
  for(const bar of bars)expect(bar.fill/bar.track).toBeCloseTo(bar.count/608,2);
  await page.locator('#overview-sample-scope').selectOption('ancient');await expect(page.locator('.country-overview-total > strong')).toHaveText('2');
  expect((await page.locator('[data-country-macrogroup] em').allTextContents()).map(Number).reduce((a,b)=>a+b,0)).toBe(2);
});
