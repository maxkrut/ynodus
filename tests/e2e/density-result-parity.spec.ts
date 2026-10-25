import {expect,test,type Page} from '@playwright/test';
import {hierarchyMacrogroupsFixture} from '../fixtures/hierarchy-macrogroups.mjs';
import {densityIntervals} from '../../src/app/density-intervals';

async function observeWorker(page: Page) {
  await page.addInitScript(() => {
    const send=Worker.prototype.postMessage, installed=new WeakSet();
    const requests=new Map(), densities=new Map();
    (window as any).parityPosts=0;
    Worker.prototype.postMessage=function(message:any,...rest:any[]) {
      if(message.type==='analyze'){requests.set(message.id,message);(window as any).parityPosts++;}
      if(!installed.has(this)) {
        installed.add(this);
        this.addEventListener('message',event=>{
          const reply=event.data;
          if(reply.type==='load')(window as any).parityMax=reply.index.maxFormedYbp;
          if(reply.type!=='analyze')return;
          const formed=reply.result.formed;
          if(formed.densityRows)densities.set(formed.densityKey,formed.densityRows);
          (window as any).parityModel={query:requests.get(reply.id),formed:formed.rows,
            crossing:reply.result.crossing?.rows??[],density:densities.get(formed.densityKey)};
        });
      }
      return Reflect.apply(send,this,[message,...rest]);
    };
  });
}

async function checkUI(page:Page) {
  await expect.poll(()=>page.evaluate(()=>Boolean((window as any).parityModel))).toBe(true);
  await expect(page.locator('#live-status')).toHaveAttribute('data-busy','false');
  await expect(page.locator('#target-density')).toHaveAttribute('aria-busy','false');
  const snapshot=await page.evaluate(()=>{
    const model=(window as any).parityModel;
    const group=(node:any)=>node.macroGroup??node.project;
    const rows=(body:string)=>[...document.querySelectorAll(`${body} tr[data-result-role]`)].map(row=>({
      ids:[...row.querySelectorAll('.table-branch-identity .subclade-link')].map(node=>node.textContent?.trim()),
      group:row.getAttribute('data-macro-group'),
      total:Number(row.querySelector('.table-total strong')!.textContent!.replace(/\D/g,'')),
      color:getComputedStyle(row.querySelector('.row-macro-label i')!).backgroundColor,
    }));
    const measure=document.querySelector('[data-density-measure][aria-pressed="true"]')!.getAttribute('data-density-measure');
    const cells=[...document.querySelectorAll<HTMLElement>('#target-density [data-density-index]')].map(cell=>({
      index:Number(cell.dataset.densityIndex),count:Number(cell.dataset.densityCount??0),
      value:Number(cell.dataset.densityValue??0),selected:cell.classList.contains('has-current-results'),
      current:Number((cell.dataset.tooltip?.match(/(?:Subclades in matching branches|Субкладов в найденных ветвях):\s*([\d\s,]+)/)?.[1]??'0').replace(/\D/g,'')),
      groups:[...cell.querySelectorAll('.density-macro-letter')].map(node=>node.textContent),
      colors:[...cell.querySelectorAll('.density-macro-stack i')].map(node=>getComputedStyle(node).backgroundColor),
      weights:[...cell.querySelectorAll('.density-macro-stack i')].map(node=>Number(getComputedStyle(node).flexGrow)),
    }));
    const regions=[...document.querySelectorAll<HTMLElement>('.density-result-range')].map(node=>node.getBoundingClientRect());
    const boxes=[...document.querySelectorAll<HTMLElement>('#target-density [data-density-index]')].map(node=>({
      selected:node.classList.contains('has-current-results'),box:node.getBoundingClientRect()}));
    const contains=(a:DOMRect,b:DOMRect)=>b.left>=a.left-.5&&b.right<=a.right+.5;
    return {query:model.query,posts:(window as any).parityPosts,max:(window as any).parityMax,
      formed:model.formed.map((row:any)=>({id:row.node.id,group:group(row.node),total:row.total})),
      crossing:model.crossing.map((row:any)=>({ids:[row.node.id,row.crossingChild.id],group:group(row.node),total:row.total})),
      members:model.formed.flatMap((row:any)=>row.formedEvents.flatMap((event:any)=>event.formedMembers.map((member:any)=>member.node.id))),
      density:model.density.map((row:any)=>({id:row.node.id,age:row.node.formed,group:group(row.node)})),
      cells,measure,rows:rows('#result-body'),edges:rows('#crossing-result-body'),
      step:Number((document.querySelector('#density-step') as HTMLInputElement).value),
      anchor:(document.querySelector('#density-anchor') as HTMLSelectElement).value,
      sliderMax:Number((document.querySelector('#target-slider') as HTMLInputElement).max),
      filter:(document.querySelector('#result-macrogroup-filter') as HTMLSelectElement).value,
      covered:boxes.every(cell=>regions.filter(region=>contains(region,cell.box)).length===(cell.selected?1:0)),
    };
  });
  expect(snapshot.covered).toBe(true);
  const intervals=densityIntervals(snapshot.step,snapshot.sliderMax,{fullRange:snapshot.sliderMax===20000,maxFormedYbp:snapshot.max},
    snapshot.anchor==='target'?snapshot.query.target:undefined);
  const bins=intervals.map(()=>({count:0,current:0,groups:new Map<string,number>()}));
  const members=new Set(snapshot.members);
  for(const node of snapshot.density){
    const i=intervals.findIndex((bin,index)=>node.age<=bin.older&&(node.age>bin.younger||index===intervals.length-1&&node.age===bin.younger));
    expect(i).toBeGreaterThanOrEqual(0);
    const bin=bins[i];bin.count++;if(members.has(node.id))bin.current++;
    bin.groups.set(node.group,(bin.groups.get(node.group)??0)+1);
  }
  const colors=new Map<string,string>();
  for(const cell of snapshot.cells){
    const bin=bins[cell.index];
    expect(cell.count).toBe(bin.count);expect(cell.current).toBe(bin.current);expect(cell.selected).toBe(bin.current>0);
    const expectedValue=snapshot.measure==='count'?bin.count:bin.count*1000/(intervals[cell.index].older-intervals[cell.index].younger);
    expect(cell.value).toBeCloseTo(expectedValue,8);
    const groups=[...bin.groups].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([group])=>group);
    expect(cell.groups).toEqual(groups);
    expect(cell.weights).toEqual(groups.map(group=>bin.groups.get(group)));
    for(let i=0;i<groups.length;i++){
      if(colors.has(groups[i]))expect(cell.colors[i]).toBe(colors.get(groups[i]));
      colors.set(groups[i],cell.colors[i]);
    }
  }
  expect(snapshot.cells.reduce((sum,cell)=>sum+cell.count,0)).toBe(snapshot.density.length);
  expect(snapshot.cells.reduce((sum,cell)=>sum+cell.current,0)).toBe(members.size);
  const expectedRows=snapshot.formed.filter(row=>!snapshot.filter||row.group===snapshot.filter);
  expect(snapshot.rows.map(row=>({id:row.ids[0],group:row.group,total:row.total})).sort((a,b)=>a.id!.localeCompare(b.id!)))
    .toEqual(expectedRows.sort((a,b)=>a.id.localeCompare(b.id)));
  for(const row of snapshot.rows)expect(row.color).toBe(colors.get(row.group!));
  const expectedEdges=snapshot.crossing.filter(row=>!snapshot.filter||row.group===snapshot.filter);
  expect(snapshot.edges.map(({color,...row})=>row).sort((a,b)=>a.ids.join().localeCompare(b.ids.join())))
    .toEqual(expectedEdges.sort((a,b)=>a.ids.join().localeCompare(b.ids.join())));
  return snapshot;
}

for(const width of [390,1440])test(`bars, contours and result rows agree through query and grid changes at ${width}`,async({page})=>{
  test.setTimeout(120000);
  await page.setViewportSize({width,height:1000});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await observeWorker(page);
  await page.route('**/data/hras-index.json',route=>route.fulfill({json:hierarchyMacrogroupsFixture()}));
  await page.goto('/?lang=ru&countries=RUS,POL&target=5500&window=300&min=0&presence=all');
  await checkUI(page);
  for(const locale of ['ru','en']){
    await page.locator('#locale-switcher').selectOption(locale);
    for(const anchor of ['axis','target']){
      await page.locator('#density-anchor').selectOption(anchor);
      for(const step of ['300','1200']){
        await page.locator('#density-step').fill(step);await page.locator('#density-step').press('Enter');
        for(const measure of ['count','per1000']){
          await page.locator(`[data-density-measure="${measure}"]`).click();
          await checkUI(page);
        }
      }
    }
  }
  await page.locator('#result-macrogroup-filter').selectOption('R1b');await checkUI(page);
  await page.locator('#result-macrogroup-filter').selectOption('');
  const posts=await page.evaluate(()=>(window as any).parityPosts);
  await page.locator('#include-crossing').check();
  await expect.poll(()=>page.evaluate(()=>(window as any).parityPosts)).toBeGreaterThan(posts);await checkUI(page);
  // Query changes update a previously rendered grid rather than a fresh page.
  for(const [age,delta] of [[7000,2000],[11949,400],[15000,300],[5250,0]]){
    await page.locator('#target-year').fill(String(age-1949));await page.locator('#target-year').press('Tab');
    await page.locator('#max-delta-ybp').fill(String(delta));await page.locator('#max-delta-ybp').press('Tab');
    await expect.poll(()=>page.evaluate(()=>(window as any).parityModel.query.target)).toBe(age);
    await expect.poll(()=>page.evaluate(()=>(window as any).parityModel.query.maxDeltaYbp)).toBe(delta);
    await checkUI(page);
  }
  const slider=page.locator('#target-slider');
  for(const fraction of [.2,.72]){
    const before=await page.evaluate(()=>(window as any).parityPosts);
    await slider.scrollIntoViewIfNeeded();const box=(await slider.boundingBox())!;
    await page.mouse.move(box.x+box.width*.5,box.y+box.height/2);await page.mouse.down();
    await page.mouse.move(box.x+box.width*fraction,box.y+box.height/2,{steps:4});
    await expect(page.locator('#target-density')).toHaveAttribute('aria-busy','true');
    await expect(page.locator('#target-density')).toHaveAttribute('inert','');
    await page.mouse.up();
    await expect.poll(()=>page.evaluate(()=>(window as any).parityPosts)).toBeGreaterThan(before);
    await checkUI(page);
  }
  for(const [mode,min] of [['all',0],['all',5],['any',0],['any',5]] as const){
    await page.goto(`/?lang=ru&countries=RUS,POL,FRA&target=5500&window=300&min=${min}&presence=${mode}`);
    await checkUI(page);
  }
  await page.mouse.move(0,0);
  await page.locator('.timeline-zone').screenshot({path:`output/density-result-parity/checked-${width}.png`});
  expect(errors).toEqual([]);
});
