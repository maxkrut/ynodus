import {mkdir} from 'node:fs/promises';
import {expect,test} from '@playwright/test';
import {compact} from '../../scripts/semantic-audit/fixtures.mjs';

for(const locale of ['ru','en']) test(`Crossing diagram explains filled and hollow points in ${locale}`,async({page})=>{
  const data=compact([-1,0,1],[235900,5500,500],[[2,0,3]]);
  data.countryCodes=['RUS'];data.countryCounts=[3];
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/data/hras-index.json',route=>route.fulfill({json:data}));
  await page.goto(`/?lang=${locale}&countries=RUS&presence=any&target=5500&window=100&min=0`);
  const rows=page.locator('#result-body tr[data-result-role="formed"]');
  await expect(rows).toHaveCount(1);
  const originalUrl=page.url();
  const trigger=page.locator('#query-crossing-control [data-annotation="crossing"]');
  const panel=page.locator('#context-annotation');
  for(const viewport of [{width:340,height:640},{width:390,height:844},{width:844,height:390},{width:1440,height:1000}]){
    await page.setViewportSize(viewport);
    await trigger.scrollIntoViewIfNeeded();await trigger.focus();await page.keyboard.press('Enter');
    await expect(panel).toBeVisible();
    const figure=panel.locator('.crossing-mini-figure');
    await expect(figure).toContainText(locale==='ru'?'Закрашенная точка: Formed в окне':'Filled: Formed inside the window');
    await expect(figure).toContainText(locale==='ru'?'Пустая точка: Formed вне окна':'Hollow: Formed outside the window');
    await expect(figure).toContainText(locale==='ru'?'Два разных примера':'Two different examples');
    await expect(panel.locator('p')).toContainText(locale==='ru'?'Допуск ± здесь не используется':'The ± window is not used here');
    const geometry=await panel.evaluate(el=>{
      const box=el.getBoundingClientRect(),svg=el.querySelector('svg')!;
      const filled=svg.querySelector('.crossing-mini-filled')!,hollow=[...svg.querySelectorAll('.crossing-mini-hollow')];
      const window=svg.querySelector('.crossing-mini-window')!,target=svg.querySelector('.crossing-mini-date')!;
      const left=Number(window.getAttribute('x')),right=left+Number(window.getAttribute('width'));
      const x=(node:Element)=>Number(node.getAttribute('cx'));
      const svgBox=svg.getBoundingClientRect();
      return{left:box.left,right:box.right,top:box.top,bottom:box.bottom,scrollX:el.scrollWidth-el.clientWidth,scrollY:el.scrollHeight-el.clientHeight,
        filledInside:x(filled)>left&&x(filled)<right,hollowOutside:hollow.every(node=>x(node)<left||x(node)>right),
        targetInside:Number(target.getAttribute('x1'))>left&&Number(target.getAttribute('x1'))<right,
        paintsDiffer:getComputedStyle(filled).fill!==getComputedStyle(hollow[0]).fill,
        legendPaintsDiffer:getComputedStyle(el.querySelector('.crossing-key-filled')!).backgroundColor!==getComputedStyle(el.querySelector('.crossing-key-hollow')!).backgroundColor,
        textInside:[...svg.querySelectorAll('text')].every(text=>{const r=text.getBoundingClientRect();return r.left>=svgBox.left-.5&&r.right<=svgBox.right+.5;})};
    });
    expect(geometry.left).toBeGreaterThanOrEqual(0);expect(geometry.right).toBeLessThanOrEqual(viewport.width);
    expect(geometry.top).toBeGreaterThanOrEqual(0);expect(geometry.bottom).toBeLessThanOrEqual(viewport.height);
    expect(geometry.scrollX).toBeLessThanOrEqual(1);expect(geometry.scrollY).toBeLessThanOrEqual(1);
    expect(geometry.filledInside&&geometry.hollowOutside&&geometry.targetInside&&geometry.paintsDiffer&&geometry.legendPaintsDiffer&&geometry.textInside).toBe(true);
    if(viewport.width===390||viewport.width===1440){
      await mkdir('output/crossing-note-2026-10-22',{recursive:true});
      await panel.screenshot({path:`output/crossing-note-2026-10-22/production-${locale}-${viewport.width}.png`});
    }
    expect(page.url()).toBe(originalUrl);await expect(rows).toHaveCount(1);await expect(page.locator('#include-crossing')).not.toBeChecked();
    await page.keyboard.press('Escape');await expect(panel).toBeHidden();await expect(trigger).toBeFocused();
  }
  await page.locator('#locale-switcher').selectOption(locale==='ru'?'en':'ru');
  await trigger.click();await expect(panel).toContainText(locale==='ru'?'Hollow: Formed outside the window':'Пустая точка: Formed вне окна');
  await page.locator('#timeline-zone-title').click();await expect(panel).toBeHidden();
  expect(errors).toEqual([]);
});
