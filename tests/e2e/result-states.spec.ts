import fs from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { resultStatesFixture, resultStateQuery } from '../fixtures/result-states.mjs';
async function capture(page: Page, name: string) {
  await fs.mkdir('output/result-states', {recursive:true});
  await page.mouse.move(0,0); await page.keyboard.press('Escape'); await page.evaluate(()=> (document.activeElement as HTMLElement)?.blur());
  await page.locator('.results-zone').evaluate(e=>e.scrollIntoView({block:'start'}));
  await page.screenshot({path:'output/result-states/' + name + '.png'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
}
for(const width of [390,768,1440]) test('long results, disclosure, last page and Crossing at '+width, async({page})=>{
  await page.setViewportSize({width,height:1000});
  const errors: string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/data/hras-index.json',r=>r.fulfill({json:resultStatesFixture()}));
  await page.goto(resultStateQuery);await expect(page.locator('#export-csv')).toBeEnabled();
  const rows=page.locator('#result-body tr[data-result-role]');await expect(rows).toHaveCount(50);
  await expect(page.locator('#result-count')).toHaveText('120');
  const disclosure=rows.first().locator('details');await disclosure.locator('summary').click();
  await expect(rows.first().locator('.country-pill')).toHaveCount(20);
  await capture(page,'long-'+width);
  await disclosure.locator('summary').click();await expect(disclosure).not.toHaveAttribute('open','');
  const more=page.locator('#result-body [data-show-more-results]');await more.click();await expect(rows).toHaveCount(100);await expect(more).toBeFocused();
  await more.click();await expect(rows).toHaveCount(120);await expect(more).toHaveCount(0);await expect(page.locator('#result-range')).toBeFocused();
  await expect(page.locator('#result-range')).toContainText('1-120');
  await page.locator('#result-range').evaluate(e=>(e as HTMLElement).blur());
  await expect(page.locator('#result-range')).toBeInViewport();
  await page.locator('#result-head [data-table-sort="subclade"]').click();await expect(rows).toHaveCount(50);
  await page.locator('#result-macrogroup-filter').selectOption('I2');await expect(page.locator('#result-count')).toHaveText('60 / 120');
  await expect(page.locator('#crossing-result-body tr[data-result-role]')).toHaveCount(3);
  await expect(page.locator('#crossing-macrogroup-filter option')).toHaveText(['Все макрогруппы', 'R1a']);
  await expect(page.locator('#crossing-macrogroup-filter')).toHaveValue('');
  await page.locator('#result-macrogroup-filter').selectOption('');
  await expect(page.locator('#crossing-result-body tr[data-result-role]')).toHaveCount(3);
  await page.locator('#crossing-results-section').evaluate(e=>e.scrollIntoView({block:'start'}));
  await page.screenshot({path:'output/result-states/crossing-'+width+'.png'});
  await page.goto(resultStateQuery.replace('target=5500','target=100000').replace('window=100','window=0'));
  await expect(page.locator('#result-body .no-result-message')).toBeVisible();await expect(page.locator('#export-csv')).toBeDisabled();
  await capture(page,'empty-'+width);
  await page.locator('#result-body [data-suggest-ybp]').first().click();await expect(page.locator('#export-csv')).toBeEnabled();expect(errors).toEqual([]);
});
test('load failure and recovery preserve a clear next action', async({page})=>{
  await page.setViewportSize({width:390,height:1000});let failed=true;
  await page.route('**/data/hras-index.json',r=>failed?r.fulfill({status:503,body:'Synthetic outage'}):r.fulfill({json:resultStatesFixture()}));
  await page.goto(resultStateQuery);await expect(page.locator('#empty-state')).toHaveAttribute('role','alert');await capture(page,'load-error');
  await expect(page.locator('[data-retry-load]')).toBeEnabled();failed=false;await page.locator('[data-retry-load]').click();await expect(page.locator('#export-csv')).toBeEnabled();
});
test('pending and analysis failure never expose old results as current', async({page})=>{
  await page.setViewportSize({width:390,height:1000});
  await page.addInitScript(()=>{
    const original=Worker.prototype.postMessage;
    (window as any).analysisMode='normal';
    Worker.prototype.postMessage=function(message: any){
      if(message.type==='analyze' && (window as any).analysisMode==='hold') {(window as any).releaseAnalysis=()=>original.call(this,message);return;}
      if(message.type==='analyze' && (window as any).analysisMode==='fail') {queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{id:message.id,type:'error',message:'Synthetic calculation failure'}})));return;}
      return original.call(this,message);
    };
  });
  await page.route('**/data/hras-index.json',r=>r.fulfill({json:resultStatesFixture()}));await page.goto(resultStateQuery);await expect(page.locator('#export-csv')).toBeEnabled();
  await page.evaluate(()=>{(window as any).analysisMode='hold';});await page.locator('#target-year').fill('3552');await page.locator('#target-year').press('Enter');
  await expect(page.locator('#results')).toHaveAttribute('aria-busy','true');await expect(page.locator('#result-count')).toHaveText('-');await expect(page.locator('#crossing-result-count')).toHaveText('-');await expect(page.locator('#export-csv')).toBeDisabled();await expect(page.locator('#query-results-jump')).toBeDisabled();await expect(page.locator('#query-result-summary')).toBeHidden();await expect(page.locator('#result-body tr[data-result-role]')).toHaveCount(0);await capture(page,'pending');
  await page.waitForFunction(()=>typeof (window as any).releaseAnalysis==='function');await page.evaluate(()=>{(window as any).analysisMode='normal';(window as any).releaseAnalysis();});await expect(page.locator('#export-csv')).toBeEnabled();
  await page.evaluate(()=>{(window as any).analysisMode='fail';});await page.locator('#target-year').fill('3553');await page.locator('#target-year').press('Enter');await expect(page.locator('#empty-state')).toHaveAttribute('role','alert');await expect(page.locator('#results')).toBeHidden();await capture(page,'analysis-error');
  await page.locator('#locale-switcher').selectOption('en');await expect(page.locator('[data-retry-analysis]')).toHaveText('Retry calculation');
  const url=page.url();await page.evaluate(()=>{(window as any).analysisMode='normal';});await page.locator('[data-retry-analysis]').click();await expect(page.locator('#export-csv')).toBeEnabled();expect(page.url()).toBe(url);
});
