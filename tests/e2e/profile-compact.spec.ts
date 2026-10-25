import {mkdir} from 'node:fs/promises';
import {expect,test} from '@playwright/test';
import {branchCountriesFixture} from '../fixtures/branch-countries.mjs';
import {expectReadableText,measureTextStates} from './contrast-support';

const ids=page=>page.locator('.tree-sheet [data-tree-node]').evaluateAll(rows=>rows.map(row=>row.getAttribute('data-tree-node')));
for(const width of [390,1440]) test(`compact profile, single-country scope and sample types at ${width}`,async({page})=>{
  test.setTimeout(60000);
  const data={...branchCountriesFixture(),ancientCounts:[2,1,4,3,0,0,0]};
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width,height:1000});
  await page.route('**/data/hras-index.json',route=>route.fulfill({json:data}));
  for(const locale of ['ru','en']){
    await page.goto(`/?lang=${locale}&view=profile&clade=R-SYN-ROOT&countries=RUS&min=0&samples=all`);
    await expect(page.locator('.tree-sheet [data-tree-node]')).toHaveCount(5);
    await expect(page.locator('.tree-sheet-matrix')).toHaveCount(1);
    await expect(page.locator('.profile-compact-header h3')).toHaveText('R-SYN-ROOT');
    await expect(page.locator('[data-profile-scope-total]')).toHaveText('20');
    await expect(page.locator('.profile-compact-path')).toHaveCount(0);
    await expect(page.locator('.profile-country-chip .flag')).toHaveCount(3);
    await expect(page.locator('#profile-content .ancient-count-note, #profile-content .tree-cell-ancient')).toHaveCount(0);
    await expect(page.locator('.tree-node-col > small, .tree-node-col .same-formed-marker')).toHaveCount(0);
    const labels=await page.locator('.tree-sheet [data-tree-node]').evaluateAll(rows=>rows.map(row=>({
      id:row.getAttribute('data-tree-node'),text:row.querySelector('.tree-node-col')!.textContent!.replace(/[▾▸↗\s]/g,'')
    })));
    for(const label of labels) expect(label.text).toBe(label.id);
    await expect(page.locator('[data-tree-node="R-SYN-ROOT"] .tree-sheet-stem')).toHaveCount(1);
    await expect(page.locator('[data-tree-node="R-SYN-B"] .tree-sheet-joint:not(.is-last)')).toHaveCount(1);
    await expect(page.locator('[data-tree-node="R-SYN-A"] .tree-sheet-joint.is-last')).toHaveCount(1);
    await expect(page.locator('[data-tree-node="R-SYN-B1"] .tree-sheet-guide')).toHaveCount(1);
    expect(await page.locator('[data-tree-node="R-SYN-B1"] .tree-sheet-guide').evaluate(el=>el.style.getPropertyValue('--tree-level'))).toBe('0');
    const originalUrl=page.url();
    const rootRow=page.locator('[data-tree-node="R-SYN-ROOT"]');
    const originalColour=await rootRow.locator('.tree-country-cell[data-count="7"]').evaluate(el=>getComputedStyle(el).backgroundColor);
    await page.locator('.matrix-country-heading[data-tree-country="RUS"]').click();
    expect(await ids(page)).toEqual(['R-SYN-ROOT','R-SYN-A','R-SYN-A1']);
    await expect(page.locator('#profile-country-filter')).toHaveValue('RUS');
    await expect(page.locator('[data-profile-scope-total]')).toHaveText('7');
    await expect(page.locator('.tree-sheet-guide')).toHaveCount(0);
    expect(page.url()).toBe(originalUrl);
    expect(await rootRow.locator('.tree-country-cell[data-count="7"]').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe(originalColour);
    if(width===1440) expectReadableText(await measureTextStates(page,[{name:'Pastel Blues count',control:rootRow.locator('.tree-country-cell:not(.is-muted) button').first()}]));
    await page.locator('.matrix-country-heading[data-tree-country="POL"]').click();
    expect(await ids(page)).toEqual(['R-SYN-ROOT','R-SYN-B','R-SYN-A','R-SYN-A1']);
    await expect(page.locator('.matrix-country-heading[data-tree-country="RUS"]')).toHaveAttribute('aria-pressed','false');
    await expect(page.locator('#profile-country-filter')).toHaveValue('POL');
    await page.locator('#profile-country-filter').selectOption('FRA');
    expect(await ids(page)).toEqual(['R-SYN-ROOT','R-SYN-B','R-SYN-B1']);
    await expect(page.locator('[data-tree-node="R-SYN-B"] .tree-sheet-joint.is-last')).toHaveCount(1);
    await expect(page.locator('.tree-sheet-guide')).toHaveCount(0);

    expect(await ids(page)).toEqual(['R-SYN-ROOT','R-SYN-B','R-SYN-B1']);

    await mkdir('output/profile-compact-2026-10-23',{recursive:true});
    await page.locator('#profile-workspace').screenshot({path:`output/profile-compact-2026-10-23/filtered-${locale}-${width}.png`});
    await page.reload();await expect(page.locator('#profile-country-filter')).toHaveValue('FRA');
    await page.locator('[data-profile-country-reset]').click();
    await expect(page.locator('.tree-sheet [data-tree-node]')).toHaveCount(5);
    await expect(page.locator('[data-profile-country-reset]')).toBeDisabled();
    const geometry=await page.evaluate(()=>{
      const header=document.querySelector('.profile-compact-header')!.getBoundingClientRect(),tree=document.querySelector('.tree-sheet-scroll')!.getBoundingClientRect(),content=document.querySelector('#profile-content')!.getBoundingClientRect();
      return{overflow:document.documentElement.scrollWidth-innerWidth,headerWidth:header.width,headerHeight:header.height,headerBottom:header.bottom,treeTop:tree.top,width:tree.width,contentWidth:content.width};
    });
    expect(geometry.overflow).toBe(0);expect(geometry.headerBottom).toBeLessThan(geometry.treeTop);
    expect(Math.abs(geometry.width-geometry.contentWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.headerWidth-geometry.contentWidth)).toBeLessThanOrEqual(1);
    if(width===1440) expect(geometry.headerHeight).toBeLessThan(160);
    await page.locator('#profile-workspace').screenshot({path:`output/profile-compact-2026-10-23/all-${locale}-${width}.png`});

    await page.locator('#profile-workspace').screenshot({path:`output/profile-compact-2026-10-23/tree-${locale}-${width}.png`});

    await page.locator('#profile-sample-scope').selectOption('modern');
    await expect(page).toHaveURL(/samples=modern/);
    await expect(page.locator('.tree-sheet [data-tree-node]')).toHaveCount(3);
    expect(await ids(page)).toEqual(['R-SYN-ROOT','R-SYN-B','R-SYN-B1']);
    await expect(page.locator('[data-profile-scope-total]')).toHaveText('10');
    await expect(page.locator('#profile-country-filter option[value="RUS"]')).toHaveCount(0);
    await page.locator('#profile-sample-scope').selectOption('ancient');
    await expect(page).toHaveURL(/samples=ancient/);
    await expect(page.locator('.tree-sheet [data-tree-node]')).toHaveCount(3);
    expect(await ids(page)).toEqual(['R-SYN-ROOT','R-SYN-A','R-SYN-A1']);
    await expect(page.locator('[data-profile-scope-total]')).toHaveText('10');
    await page.locator('#profile-workspace').screenshot({path:`output/profile-compact-2026-10-23/ancient-${locale}-${width}.png`});
    expect(new URL(page.url()).searchParams.get('lang')).toBe(locale);
    expect(new URL(page.url()).searchParams.get('countries')).toBe('RUS');
  }
  expect(errors).toEqual([]);
});
