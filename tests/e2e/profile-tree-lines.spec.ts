import {expect,test} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {compact} from '../../scripts/semantic-audit/fixtures.mjs';

const parents=[-1,0,1,2,2,1,0,6,7,7,6,0,11,11];
const names=['ROOT','A','A1','A11','A12','A2','B','B1','B11','B12','B2','C','C1','C2'];
const leaves=[[3,[18,6,4,2]],[4,[11,9,2,1]],[5,[4,10,1,2]],[8,[3,7,2,1]],
  [9,[6,4,3,0]],[10,[2,2,8,3]],[12,[1,5,5,2]],[13,[7,3,4,1]]] as const;
const rowIds=page=>page.locator('.tree-sheet [data-tree-node]').evaluateAll(rows=>rows.map(row=>row.getAttribute('data-tree-node')));

for(const width of [390,1440]) test(`classic profile lines retain real branches at ${width}`,async({page})=>{
  const data=compact(parents,parents.map((_,i)=>7000-i*200),leaves.flatMap(([node,counts])=>counts.map((count,country)=>[node,country,count]).filter(row=>row[2]>0)));
  data.nodeIds=names.map(name=>`R-SYN-${name}`);
  data.countryCodes=['RUS','POL','UKR','DEU'];data.countryCounts=[52,46,29,12];
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width,height:1100});
  await page.route('**/data/hras-index.json',route=>route.fulfill({json:data}));
  await page.goto('/?lang=ru&view=profile&clade=R-SYN-ROOT&countries=RUS&min=0');
  await expect(page.locator('.tree-sheet [data-tree-node]')).toHaveCount(14);
  const leaf=page.locator('[data-tree-node="R-SYN-A11"]');
  await expect(leaf.locator('.tree-sheet-guide')).toHaveCount(2);
  await expect(page.locator('[data-tree-node="R-SYN-C"] .tree-sheet-joint.is-last')).toHaveCount(1);
  const geometry=await page.evaluate(()=>{
    const stem=document.querySelector('[data-tree-node="R-SYN-ROOT"] .tree-sheet-stem')!.getBoundingClientRect();
    const joint=document.querySelector('[data-tree-node="R-SYN-A"] .tree-sheet-joint')!.getBoundingClientRect();
    return {stemX:stem.x,jointX:joint.x,gap:joint.top-stem.bottom};
  });
  expect(Math.abs(geometry.stemX-geometry.jointX)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.gap)).toBeLessThanOrEqual(1.5);
  if(width===390) {
    const heights=await page.locator('.tree-sheet [data-tree-node]').evaluateAll(rows=>rows.map(row=>row.getBoundingClientRect().height));
    expect(Math.max(...heights)).toBeLessThanOrEqual(54);
  }
  const folder='output/profile-classic-2026-10-23';await mkdir(folder,{recursive:true});
  await page.locator('#profile-workspace').screenshot({path:`${folder}/matrix-${width}.png`});
  await page.locator('[data-evidence-tree-toggle="R-SYN-A1"]').click();
  await expect(leaf).toHaveCount(0);
  await expect(page.locator('[data-tree-node="R-SYN-A1"] .tree-sheet-stem')).toHaveCount(0);
  await page.locator('[data-evidence-tree-toggle="R-SYN-A1"]').click();
  await page.locator('#profile-tree-search').fill('R-SYN-A11');
  await expect.poll(()=>rowIds(page)).toEqual(['R-SYN-ROOT','R-SYN-A','R-SYN-A1','R-SYN-A11']);
  await expect(page.locator('.tree-sheet-guide')).toHaveCount(0);
  await page.locator('#profile-tree-search').fill('');
  await page.locator('#profile-country-filter').selectOption('DEU');
  await expect(page.locator('.tree-sheet [data-tree-node]')).toHaveCount(13);
  await expect(page.locator('[data-tree-node="R-SYN-B12"]')).toHaveCount(0);
  await expect(page.locator('[data-tree-node="R-SYN-B1"]')).toHaveCount(1);
  await expect(page.locator('[data-profile-scope-total]')).toHaveText('12');
  await page.locator('#profile-workspace').screenshot({path:`${folder}/filtered-${width}.png`});
  await page.locator('[data-profile-country-reset]').click();

  await expect(page.locator('.tree-sheet [data-tree-node]')).toHaveCount(14);
  await page.locator('#profile-workspace').screenshot({path:`${folder}/tree-${width}.png`});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
  expect(errors).toEqual([]);
});
