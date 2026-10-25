import {mkdir} from 'node:fs/promises';
import {expect,test} from '@playwright/test';
import {compact} from '../../scripts/semantic-audit/fixtures.mjs';

for(const locale of ['ru','en']) test(`complete epoch names remain readable in ${locale}`,async({page})=>{
  const data=compact([-1,0,1],[235900,5500,500],[[2,0,3]]);
  data.countryCodes=['RUS'];data.countryCounts=[3];
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const remoteFonts:string[]=[];page.on('request',request=>{if(/fonts\.(?:googleapis|gstatic)\.com/.test(request.url()))remoteFonts.push(request.url());});
  await page.route('**/data/hras-index.json',route=>route.fulfill({json:data}));
  await page.goto(`/?lang=${locale}&countries=RUS&presence=any&target=5500&window=100&min=0`);
  await expect(page.locator('#result-body tr[data-result-role="formed"]')).toHaveCount(1);
  await page.evaluate(()=>document.fonts.ready);
  for(const width of [340,390,760,980,1440,2550]){
    await page.setViewportSize({width,height:1000});
    await expect.poll(()=>page.locator('.period-band-label').evaluateAll(labels=>{
      const bounds=labels.map(label=>label.getBoundingClientRect());
      return bounds.every((box,index)=>box.left>=-.5&&box.right<=innerWidth+.5&&
        bounds.every((other,i)=>i===index||box.right<=other.left+.5||other.right<=box.left+.5||box.bottom<=other.top+.5||other.bottom<=box.top+.5));
    })).toBe(true);
    const reading=await page.locator('.time-axis-periods').evaluate(strip=>{
      const rect=strip.getBoundingClientRect();
      const labels=[...strip.querySelectorAll<HTMLElement>('.period-band-label')];
      return{height:rect.height,overflow:document.documentElement.scrollWidth-innerWidth,
        labels:labels.map(label=>({text:label.textContent,hidden:getComputedStyle(label).fontSize==='0px',
          right:label.getBoundingClientRect().right,bottom:label.getBoundingClientRect().bottom,
          font:getComputedStyle(label).fontFamily})),bottom:rect.bottom,
        inset:[...strip.querySelectorAll<HTMLElement>('.has-period-inset')].map(band=>{
          const label=band.querySelector<HTMLElement>('.period-band-label')!;
          const box=band.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(label);
          const lines=[...range.getClientRects()];
          return{text:label.textContent,font:getComputedStyle(label).fontSize,width:box.width,
            glyphs:lines.map(line=>({left:line.left-box.left,right:line.right-box.right,top:line.top-box.top,bottom:line.bottom-box.bottom})),
            callout:band.classList.contains('has-period-callout'),vertical:band.classList.contains('has-period-vertical'),
            lines:lines.length,contained:lines.every(line=>line.left>=box.left-.5&&line.right<=box.right+.5&&line.top>=box.top-.5&&line.bottom<=box.bottom+.5)};
        }),
        bracket:getComputedStyle(strip.querySelector('[data-period-band]')!).borderBottomWidth,
        hatch:getComputedStyle(strip.querySelector('[data-period-band="modern"]')!,'::before').backgroundImage,
        loaded:document.fonts.check('600 14px "Roboto Condensed Epochs"')};
    });
    expect(reading.labels).toHaveLength(8);expect(reading.overflow).toBeLessThanOrEqual(0);
    expect(reading.loaded).toBe(true);
    expect(reading.labels.every(label=>!label.hidden&&label.font.includes('Roboto Condensed Epochs')&&label.bottom<=reading.bottom+.5)).toBe(true);
    expect(reading.labels[6].text).toBe(locale==='ru'?'Средние века':'Medieval');
    expect(reading.labels[7].text).toBe(locale==='ru'?'Новое и Новейшее время':'Modern era');
    expect(reading.inset).toHaveLength(2);
    expect(reading.inset.every(label=>label.contained&&!label.callout&&(label.vertical||label.lines<=2)),`${width}px ${JSON.stringify(reading.inset)}`).toBe(true);
    expect(Number.parseFloat(reading.bracket)).toBeGreaterThan(0);
    expect(Number.parseFloat(reading.bracket)).toBeLessThanOrEqual(2);
    expect(reading.hatch).toContain('repeating-linear-gradient');
    if(width===390||width===1440||width===2550){
      await mkdir('output/epoch-strip-2026-10-22',{recursive:true});
      await page.locator('.time-axis-periods').screenshot({path:`output/epoch-strip-2026-10-22/current-${locale}-${width}.png`});
      if(width===1440) await page.locator('.timeline-zone').screenshot({path:`output/epoch-strip-2026-10-22/timeline-${locale}-${width}.png`});
    }
  }
  await page.setViewportSize({width:390,height:1000});
  await page.addStyleTag({content:'* { line-height:1.5!important; letter-spacing:.12em!important; word-spacing:.16em!important; }'});
  await expect.poll(()=>page.locator('.period-band-label').evaluateAll(labels=>{
    const boxes=labels.map(label=>label.getBoundingClientRect());
    return boxes.every((box,index)=>box.left>=-.5&&box.right<=innerWidth+.5&&
      boxes.every((other,i)=>i===index||box.right<=other.left+.5||other.right<=box.left+.5||box.bottom<=other.top+.5||other.bottom<=box.top+.5));
  })).toBe(true);
  await page.locator('#locale-switcher').selectOption(locale==='ru'?'en':'ru');
  await expect(page.locator('[data-period-band="medieval"] .period-band-label')).toHaveText(locale==='ru'?'Medieval':'Средние века');
  expect(remoteFonts).toEqual([]);expect(errors).toEqual([]);
});
