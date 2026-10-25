import {expect,type Page} from '@playwright/test';
import {layoutFixture,layoutQuery} from '../fixtures/layout.mjs';
import {mkdir} from 'node:fs/promises';

const auditOutput='output/visual-audit-2026-10-23';
export async function startAudit(page:Page,width=1440,lang='ru',query=layoutQuery){
  const data=layoutFixture();data.ancientCounts=data.samples.map((_,i)=>i%7===0?1:0);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width,height:1000});
  await page.addInitScript(()=>{
    const send=Worker.prototype.postMessage;
    (window as any).audit={messages:[],hold:false,held:[]};
    Worker.prototype.postMessage=function(message:any,...rest:any[]){
      const a=(window as any).audit;a.messages.push(message.type);
      if(message.type==='analyze'&&a.hold){a.held.push(()=>Reflect.apply(send,this,[message,...rest]));return;}
      return Reflect.apply(send,this,[message,...rest]);
    };
  });
  await page.route('**/data/hras-index.json',route=>route.fulfill({json:data}));
  await page.goto(query.replace('lang=ru','lang='+lang));
  await expect(page.locator('#export-csv')).toBeEnabled();
  await page.evaluate(()=>document.fonts.ready);
  await mkdir(auditOutput,{recursive:true});
  return errors;
}
export const analyses=(page:Page)=>page.evaluate(()=>(window as any).audit.messages.filter(type=>type==='analyze').length);
export async function markChart(page:Page){
  await page.evaluate(()=>{(window as any).auditCells=[...document.querySelectorAll('#target-density .density-cell')];});
}
export const sameChart=(page:Page)=>page.evaluate(()=>(window as any).auditCells?.every((el,i)=>el===document.querySelectorAll('#target-density .density-cell')[i]));
export async function fit(page:Page){
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
}
export async function capture(page:Page,name:string,selector?:string){
  await fit(page);await page.mouse.move(1,1);
  await (selector?page.locator(selector):page).screenshot({path:`${auditOutput}/${name}.png`,...(selector?{}:{fullPage:false})});
}
