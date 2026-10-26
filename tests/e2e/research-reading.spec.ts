import {expect,test,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {compact} from '../../scripts/semantic-audit/fixtures.mjs';

const ready=async(page:Page)=>{
  await expect(page.locator('#live-status')).toHaveAttribute('data-busy','false');
  await expect(page.locator('#target-density')).toHaveAttribute('aria-busy','false');
};
const bars=(page:Page)=>page.locator('#target-density button').evaluateAll(nodes=>nodes.map(node=>({
  count:(node as HTMLElement).dataset.densityCount,value:(node as HTMLElement).dataset.densityValue,
  fills:node.querySelector('.density-macro-stack')?.innerHTML,
})));

test('macrogroup and country changes reconcile the selected inspector',async({page})=>{
  const data=compact([-1,0,0,1,2,2],[20000,10000,10000,5000,5000,5000],[[3,0,5],[4,0,4],[5,1,3]]);
  data.nodeIds=['R','R1a','R1b','R-SYN-A','R-SYN-B-RUS','R-SYN-B-POL'];
  data.countryCodes=['RUS','POL'];data.countryCounts=[9,3];data.projectIds=['R'];
  await page.route('**/data/hras-index.json',route=>route.fulfill({json:data}));
  await page.goto('/?lang=en&view=profile&clade=R&countries=RUS,POL&min=0');
  await page.locator('[data-research-expand]').click();
  await page.locator('[data-profile-select="R-SYN-B-RUS"]').click();
  const inspector=page.locator('[data-profile-inspector]');
  await expect(inspector).toContainText('R-SYN-B-RUS');
  await page.locator('[data-research-macro]').selectOption('R1a');
  await expect(inspector).toContainText('R1a');await expect(inspector).not.toContainText('R-SYN-B-RUS');
  await page.locator('[data-profile-select="R"]').click();
  await page.locator('#locale-switcher').selectOption('ru');
  await expect(page.locator('[data-profile-select="R"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('[data-profile-inspector-disclosure]')).toHaveAttribute('open','');
  await page.reload();
  await expect(page.locator('[data-profile-select="R"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('[data-profile-inspector-disclosure]')).toHaveAttribute('open','');
  await page.locator('[data-profile-country-filter]').selectOption('POL');
  await expect(page.locator('[data-profile-inspector-disclosure]')).toBeHidden();
  await page.locator('[data-research-macro]').selectOption('R1b');
  await expect(inspector).toContainText('R1b');
  await page.goto('/?lang=en&view=country-overview&country=RUS&countries=RUS,POL&min=0');
  await page.locator('.country-comparison-open').click();
  await page.locator('[data-comparison-dialog] [data-country-code="POL"]').check();
  await page.locator('[data-comparison-apply]').click();
  await page.locator('[data-research-group="R1b"]').click();
  await page.locator('[data-profile-select="R-SYN-B-RUS"]').click();
  await expect(inspector).toContainText('R-SYN-B-RUS');
  await page.locator('[data-country-tree-filter]').selectOption('POL');
  await expect(inspector).toContainText('R1b');await expect(inspector).not.toContainText('R-SYN-B-RUS');
  await expect(page.locator('[data-country-node-details]')).not.toHaveAttribute('open','');
  await expect(page.locator('[data-country-tree-node="R-SYN-B-RUS"]')).toHaveCount(0);
});

test('parent count, shared dataset country scope and linear/log stability on Maghreb',async({page})=>{
  test.setTimeout(120000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await mkdir('output/research-reading',{recursive:true});
  await page.setViewportSize({width:1600,height:1000});
  await page.goto('/?lang=ru&countries=DZA,LBY,MAR,MRT,TUN&presence=all&min=5&target=15900&window=300');
  await ready(page);
  const raw=await bars(page), results=await page.locator('#result-body').innerHTML();
  await page.locator('[data-density-unit]').selectOption('parents');
  await expect(page.locator('.density-height-caption')).toHaveText('Высота: группы по родителям');
  const parent=await bars(page);
  expect(parent.reduce((sum,bar)=>sum+Number(bar.value),0)).toBeLessThan(raw.reduce((sum,bar)=>sum+Number(bar.value),0));
  expect(await page.locator('#result-body').innerHTML()).toBe(results);
  await page.locator('[data-density-measure="per1000"]').click();
  await expect(page.locator('.density-height-caption')).toContainText('на 1 000 лет');
  await expect(page.locator('[data-freeze-countries]')).toHaveCount(0);
  const url=new URL(page.url());expect(url.searchParams.get('min')).toBe('5');
  expect(url.searchParams.get('countries')?.split(',').sort()).toEqual(['DZA','LBY','MAR','MRT','TUN']);
  const frozen=await bars(page);
  for(const year of ['1051','13951']){
    await page.locator('#target-year').fill(year);await page.locator('#target-year').press('Tab');
    await expect.poll(()=>new URL(page.url()).searchParams.get('target')).toBe(String(Number(year)+1949));
    await ready(page);expect(await bars(page)).toEqual(frozen);
  }
  await page.mouse.move(0,0);await page.keyboard.press('Escape');
  await page.screenshot({path:'output/research-reading/timeline-parents.png'});
  await page.reload();await ready(page);await expect(page.locator('[data-density-unit]')).toHaveValue('parents');
  expect(await bars(page)).toEqual(frozen);
  expect(errors).toEqual([]);
});

for(const [width,lang] of [[1600,'ru'],[390,'en']] as const) test(`compact country and profile, ${lang} ${width}`,async({page})=>{
  test.setTimeout(120000);await mkdir('output/research-reading',{recursive:true});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width,height:1000});
  await page.goto(`/?lang=${lang}&view=country-overview&country=DEU&countries=DZA,MAR,TUN&min=0`);
  const groups=page.locator('[data-research-group]');await expect(groups.first()).toBeVisible();
  await expect(page.locator('[data-country-tree-node]')).toHaveCount(0);
  const sum=await groups.locator('b').allTextContents();
  const number=(value:string)=>Number(value.replace(/\D/g,''));
  expect(sum.reduce((total,value)=>total+number(value),0)).toBe(number(await page.locator('.country-overview-total > strong').innerText()));
  await page.screenshot({path:`output/research-reading/country-summary-${width}.png`});
  await page.locator('[data-research-group="R1b"]').click();
  await expect(page.locator('[data-country-tree-node]').first()).toBeVisible();
  await expect(page.locator('[data-research-macro]')).toHaveValue('R1b');
  expect(await page.locator('[data-country-tree-node]').count()).toBeLessThan(50);
  await page.screenshot({path:`output/research-reading/country-branches-${width}.png`});
  await page.reload();await expect(page.locator('[data-research-macro]')).toHaveValue('R1b');
  await page.locator('[data-research-collapse]').click();await expect(groups.first()).toBeVisible();
  await page.locator('[data-country-tree-search]').fill('R-M269');
  await expect(page.locator('[data-country-tree-node="R-M269"]')).toBeVisible();
  await page.goto(`/?lang=${lang}&view=profile&clade=R-M417&countries=DZA,MAR,TUN&min=0`);
  await expect(page.locator('.profile-compact-header h3')).toHaveText('R-M417');
  const rows=page.locator('[data-tree-node]');
  const baseline=await rows.count();expect(baseline).toBeLessThanOrEqual(21);
  expect(await rows.evaluateAll(nodes=>Math.max(...nodes.map(node=>Number((node as HTMLElement).dataset.treeDepth))))).toBeLessThanOrEqual(1);
  const child=rows.locator('[data-evidence-tree-toggle][aria-expanded="false"]').first();
  await child.click();expect(await rows.count()).toBeGreaterThan(baseline);
  await page.locator('[data-research-collapse]').click();await expect(rows).toHaveCount(baseline);
  await page.screenshot({path:`output/research-reading/profile-${width}.png`});
  await page.locator('[data-profile-parent]').click();
  await expect(page.locator('.profile-compact-header h3')).not.toHaveText('R-M417');
  expect(new URL(page.url()).searchParams.get('lang')).toBe(lang);
  expect(new URL(page.url()).searchParams.get('countries')).toBe('DZA,MAR,TUN');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});
