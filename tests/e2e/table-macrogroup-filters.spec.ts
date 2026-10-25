import {readFile,mkdir} from 'node:fs/promises';
import {expect,test} from '@playwright/test';
import {compact} from '../../scripts/semantic-audit/fixtures.mjs';
import {parseCsv} from '../../scripts/semantic-audit/csv.mjs';

function fixture() {
  const data=compact([-1,0,-1,2,-1,4,-1,6],[7000,5500,7000,5500,9000,3000,9000,3000],
    [[1,0,7],[1,1,3],[3,0,5],[3,1,2],[5,0,4],[5,1,1],[7,1,9]]);
  data.nodeIds=['R1a','R-SYN-FORMED-A','R1b','R-SYN-FORMED-B','I1','I-SYN-CROSS-1','I2','I-SYN-CROSS-2'];
  data.projectIds=['R','I'];
  data.nodes.forEach((node,index)=>{node[0]=index<4?0:1;});
  data.countryCodes=['RUS','POL','DEU'];
  return data;
}

for(const width of [390,1440]) for(const locale of ['ru','en']) {
  test(`independent table macrogroups, CSV and returns in ${locale} at ${width}`,async({page})=>{
    await page.setViewportSize({width,height:1000});
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{
      const send=Worker.prototype.postMessage;
      (window as any).filterAnalyses=0;
      Worker.prototype.postMessage=function(message:any,...rest:any[]){
        if(message.type==='analyze'){
          (window as any).filterAnalyses++;
          if((window as any).holdFilterAnalysis){
            (window as any).releaseFilterAnalysis=()=>Reflect.apply(send,this,[message,...rest]);
            return;
          }
        }
        return Reflect.apply(send,this,[message,...rest]);
      };
    });
    await page.route('**/data/hras-index.json',route=>route.fulfill({json:fixture()}));
    await page.goto(`/?lang=${locale}&countries=RUS,POL&presence=any&target=5500&window=100&min=0&crossing=1`);
    const formed=page.locator('#result-body tr[data-result-role]');
    const crossing=page.locator('#crossing-result-body tr[data-result-role]');
    const formedFilter=page.locator('#result-macrogroup-filter');
    const crossingFilter=page.locator('#crossing-macrogroup-filter');
    await expect(formed).toHaveCount(2);await expect(crossing).toHaveCount(2);
    expect(await formedFilter.locator('option').evaluateAll(nodes=>nodes.map(node=>(node as HTMLOptionElement).value)))
      .toEqual(['','R1a','R1b']);
    expect(await crossingFilter.locator('option').evaluateAll(nodes=>nodes.map(node=>(node as HTMLOptionElement).value)))
      .toEqual(['','I1','I2']);
    const posts=await page.evaluate(()=>(window as any).filterAnalyses);
    await formedFilter.selectOption('R1b');
    await expect(formed).toHaveCount(1);await expect(crossing).toHaveCount(2);
    await expect(page.locator('#result-count')).toHaveText('1 / 2');
    await expect(page.locator('#crossing-result-count')).toHaveText('2');
    await crossingFilter.selectOption('I2');
    await expect(formed).toHaveCount(1);await expect(crossing).toHaveCount(1);
    await expect(page.locator('#crossing-result-count')).toHaveText('1 / 2');
    await page.locator('#locale-switcher').selectOption(locale==='ru'?'en':'ru');
    await expect(formedFilter).toHaveValue('R1b');await expect(crossingFilter).toHaveValue('I2');
    expect(await page.evaluate(()=>(window as any).filterAnalyses)).toBe(posts);
    const downloadEvent=page.waitForEvent('download');await page.locator('#export-csv').click();
    const download=await downloadEvent;
    const csv=parseCsv(await readFile((await download.path())!,'utf8'));
    expect(csv.map(row=>[row.result_mode,row.macrogroup,row.macrogroup_filter]))
      .toEqual([['formed','R1b','R1b'],['crossing','I2','I2']]);
    expect(csv.map(row=>row.result_identity)).toEqual(['R-SYN-FORMED-B','I2 > I-SYN-CROSS-2']);
    await page.locator('#locale-switcher').selectOption(locale);
    await mkdir('output/table-macrogroup-filters',{recursive:true});
    await page.locator('.results-zone').screenshot({path:`output/table-macrogroup-filters/${width}-${locale}.png`});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await formed.locator('[data-open-result-detail]').click();
    await expect(page.locator('#profile-workspace')).toBeVisible();
    await expect(page.locator('#profile-content h3').first()).toHaveText('R-SYN-FORMED-B');
    await page.reload();
    await expect(page.locator('#profile-content h3').first()).toHaveText('R-SYN-FORMED-B');
    await page.locator('#profile-workspace [data-research-back]').click();
    await expect(formedFilter).toHaveValue('R1b');await expect(crossingFilter).toHaveValue('I2');
    await expect(formed).toHaveCount(1);await expect(crossing).toHaveCount(1);
    await page.evaluate(()=>{(window as any).holdFilterAnalysis=true;});
    await page.locator('#max-delta-ybp').fill('200');await page.locator('#max-delta-ybp').press('Enter');
    await expect(formedFilter).toBeDisabled();await expect(crossingFilter).toBeDisabled();
    await expect(page.locator('#export-csv')).toBeDisabled();
    await expect.poll(()=>page.evaluate(()=>typeof (window as any).releaseFilterAnalysis)).toBe('function');
    await page.evaluate(()=>{(window as any).holdFilterAnalysis=false;(window as any).releaseFilterAnalysis();});
    await expect(page.locator('#export-csv')).toBeEnabled();
    await expect(formedFilter).toHaveValue('R1b');await expect(crossingFilter).toHaveValue('I2');
    // A new date removes all Formed rows, while the chosen Crossing group still exists.
    await page.locator('#target-year').fill('4051');await page.locator('#target-year').press('Enter');
    await expect(page.locator('#result-count')).toHaveText('0');
    await expect(formedFilter).toHaveValue('');await expect(formedFilter).toBeHidden();
    await expect(crossingFilter).toHaveValue('I2');await expect(crossing).toHaveCount(1);
    await page.locator('#include-crossing').click();
    await expect(page.locator('#crossing-results-section')).toBeHidden();
    await expect(page.locator('#export-csv')).toBeDisabled();
    expect(errors).toEqual([]);
  });
}

test('a Crossing-only macrogroup never appears in the Formed selector',async({page})=>{
  await page.route('**/data/hras-index.json',route=>route.fulfill({json:fixture()}));
  await page.goto('/?lang=ru&countries=RUS&presence=all&target=5500&window=100&min=0&crossing=1');
  await expect(page.locator('#result-body tr[data-result-role]')).toHaveCount(2);
  await expect(page.locator('#crossing-result-body tr[data-result-role]')).toHaveCount(1);
  await expect(page.locator('#result-macrogroup-filter option[value="I1"]')).toHaveCount(0);
  await expect(page.locator('#crossing-macrogroup-filter option[value="I1"]')).toHaveCount(1);
  await expect(page.locator('#crossing-macrogroup-control')).toBeHidden();
});

test('returning before the reloaded index is ready preserves both selections',async({page})=>{
  let loads=0;
  let releaseData!:()=>void;
  const heldData=new Promise<void>(resolve=>{releaseData=resolve;});
  await page.route('**/data/hras-index.json',async route=>{
    if(++loads>1) await heldData;
    await route.fulfill({json:fixture()});
  });
  await page.goto('/?lang=ru&countries=RUS,POL&presence=any&target=5500&window=100&min=0&crossing=1');
  const formedFilter=page.locator('#result-macrogroup-filter');
  const crossingFilter=page.locator('#crossing-macrogroup-filter');
  await expect(formedFilter).toBeEnabled();await expect(crossingFilter).toBeEnabled();
  await formedFilter.selectOption('R1b');await crossingFilter.selectOption('I2');
  await page.locator('#result-body [data-open-result-detail]').click();
  await expect(page.locator('#profile-content h3').first()).toHaveText('R-SYN-FORMED-B');
  try {
    await page.reload();
    await page.locator('#profile-workspace [data-research-back]').click();
  } finally {releaseData();}
  await expect(page.locator('#time-workspace')).toBeVisible();
  await expect(formedFilter).toHaveValue('R1b');await expect(crossingFilter).toHaveValue('I2');
  await expect(page.locator('#result-body tr[data-result-role]')).toHaveCount(1);
  await expect(page.locator('#crossing-result-body tr[data-result-role]')).toHaveCount(1);
});
