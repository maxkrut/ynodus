import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { compact } from '../../scripts/semantic-audit/fixtures.mjs';

const codes = ['RUS','POL','UKR','DEU','FRA','GBR','IRL','ESP','ITA','AUT','CZE','SVK','SVN','HRV','SRB','BGR','ROU','HUN','DNK','SWE'];
function fixture() {
  const samples = codes.map((_,i) => [4,i,2]);
  samples.push([5,1,3],[6,0,4],[6,1,1],[7,1,1]);
  const data = compact([-1,0,0,1,3,2,2,2],[20000,15000,14000,8000,5000,4000,3000,2000],samples);
  data.nodeIds = ['I','I1','I2','I-SYN-A','I-SYN-MATCH','I-SYN-POL','I-SYN-SHARED','I-SYN-ONLY'];
  data.countryCodes = codes;
  data.countryCounts = codes.map((_,i) => samples.filter(row=>row[1]===i).reduce((sum,row)=>sum+row[2],0));
  data.projectIds = ['I'];
  return data;
}
async function start(page:Page,url:string) {
  await page.route('**/data/hras-index.json',route=>route.fulfill({json:fixture()}));
  await page.goto(url);
}
const ready = async(page:Page) => {
  await expect(page.locator('#live-status')).toHaveAttribute('data-busy','false');
  await expect(page.locator('#target-density')).toHaveAttribute('aria-busy','false');
};
test.afterEach(async({page}) => {
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
});

for(const lang of ['en','ru']) for(const width of [390,1440]) {
  test(`search collapse and country drafts survive locale and reload, ${lang} ${width}`,async({page})=>{
    await page.setViewportSize({width,height:1000});
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    await start(page,`/?lang=${lang}&view=profile&clade=I&countries=RUS,POL`);
    const search=page.locator('[data-profile-tree-search]');
    await search.fill('MATCH');
    await expect(page.locator('[data-tree-node="I-SYN-MATCH"]')).toBeVisible();
    const toggle=page.locator('[data-evidence-tree-toggle="I1"]');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded','false');
    await expect(page.locator('[data-tree-node="I-SYN-MATCH"]')).toHaveCount(0);
    await toggle.press('ArrowLeft');
    await expect(page.locator('[data-evidence-tree-toggle="I"]')).toBeFocused();
    await page.locator('#locale-switcher').selectOption(lang==='en'?'ru':'en');
    await expect(search).toHaveValue('MATCH');
    await expect(toggle).toHaveAttribute('aria-expanded','false');
    await page.reload();
    await expect(search).toHaveValue('MATCH');
    await expect(toggle).toHaveAttribute('aria-expanded','false');
    await search.fill('ONLY'); await search.fill('MATCH');
    await expect(page.locator('[data-tree-node="I-SYN-MATCH"]')).toBeVisible();
    await expect(page.locator('[data-tree-node="I-SYN-ONLY"]')).toHaveCount(0);
    await search.fill('');
    await expect(page.locator('[data-tree-node]')).toHaveCount(3);
    await page.locator('[data-profile-inspector-disclosure] > summary').click();
    await page.locator('[data-profile-countries] > summary').click();
    const countrySearch=page.locator('[data-profile-country-search]');
    await countrySearch.fill('POL');
    await expect(page.locator('[data-country-search-text]:visible')).toHaveCount(1);
    await page.locator('#locale-switcher').selectOption(lang);
    await expect(countrySearch).toHaveValue('POL');
    await expect(page.locator('[data-country-search-text]:visible')).toHaveCount(1);
    await page.reload(); await expect(countrySearch).toHaveValue('POL');
    expect(errors).toEqual([]);
  });
}

test('branch-country navigation includes the clicked country and can remove the old anchor country',async({page})=>{
  await start(page,'/?lang=en&view=country&country=RUS&clade=I2&scope=RUS&countries=RUS,UKR');
  await page.locator('[data-tree-node="I2"] [data-country-evidence="POL"]').click();
  await expect.poll(()=>new URL(page.url()).searchParams.get('country')).toBe('POL');
  expect(new URL(page.url()).searchParams.get('scope')?.split(',')).toEqual(['POL','RUS']);
  await expect(page.locator('[data-tree-node="I-SYN-POL"]')).toBeVisible();
  await page.locator('[data-tree-country="POL"]').click();
  await expect.poll(()=>new URL(page.url()).searchParams.get('scope')).toBe('POL');
  await page.locator('[data-tree-country="RUS"]').click();
  await page.locator('[data-tree-country="RUS"]').click();
  await expect.poll(()=>new URL(page.url()).searchParams.get('country')).toBe('RUS');
  await expect.poll(()=>new URL(page.url()).searchParams.get('scope')).toBe('RUS');
  await page.reload();
  await expect(page.locator('[data-tree-country="RUS"]')).toHaveAttribute('aria-pressed','true');
  expect(new URL(page.url()).searchParams.get('countries')).toBe('RUS,UKR');
});

for(const mode of ['detail','overview','branch']) test(`search can collapse in ${mode}`,async({page})=>{
  const route=mode==='detail'?'view=profile&clade=I&detail=formed&scope=RUS,POL'
    :mode==='overview'?'view=country-overview&country=RUS&scope=RUS,POL':'view=country&country=RUS&clade=I&scope=RUS,POL';
  await start(page,`/?lang=en&${route}`);
  const search=page.locator(mode==='detail'?'[data-profile-tree-search]':mode==='overview'?'[data-country-tree-search]':'[data-branch-tree-search]');
  await search.fill('MATCH');
  await expect(page.locator('[data-tree-node="I-SYN-MATCH"]')).toBeVisible();
  await page.locator('[data-evidence-tree-toggle="I1"]').click();
  await expect(page.locator('[data-tree-node="I-SYN-MATCH"]')).toHaveCount(0);
  await page.reload();
  await expect(search).toHaveValue('MATCH');
  await expect(page.locator('[data-evidence-tree-toggle="I1"]')).toHaveAttribute('aria-expanded','false');
});

test('one-country profile treats selecting its entire scope consistently',async({page})=>{
  await start(page,'/?lang=en&view=profile&clade=I-SYN-POL');
  await page.locator('[data-profile-country="POL"]').click();
  await expect(page.locator('[data-profile-country="POL"]')).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('[data-tree-country="POL"]')).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('[data-profile-country-reset]')).toBeDisabled();
  await expect(page.locator('[data-tree-country-reset]')).toHaveCount(0);
  await expect(page.locator('[data-profile-total-label]')).not.toContainText('selected');
  await expect(page.locator('[data-profile-scope-total]')).toHaveText('3');
});

test('basal macrogroup discloses hidden descendants without changing totals',async({page})=>{
  await start(page,'/?lang=en&view=profile&clade=I');
  const total=await page.locator('[data-profile-scope-total]').innerText();
  await page.locator('[data-research-macro]').selectOption('I');
  await expect(page.locator('[data-tree-node]')).toHaveCount(1);
  await expect(page.locator('.research-reading-note')).toContainText('hidden branches in other macrogroups');
  await expect(page.locator('[data-profile-scope-total]')).toHaveText(total);
  await mkdir('output/confirmed-audit',{recursive:true});
  await page.screenshot({path:'output/confirmed-audit/basal-macrogroup.png',fullPage:true});
});

test('country overview inspector identifies the scoped count and retains its search',async({page})=>{
  await start(page,'/?lang=en&view=country-overview&country=RUS&scope='+codes.join(','));
  await page.locator('[data-research-expand]').click();
  await page.locator('[data-profile-select="I"]').click();
  await expect(page.locator('[data-profile-inspector]')).toContainText('From selected countries');
  await page.locator('[data-profile-countries] > summary').click();
  await page.locator('[data-profile-country-search]').fill('POL');
  await page.locator('#locale-switcher').selectOption('ru');
  await expect(page.locator('[data-profile-country-search]')).toHaveValue('POL');
  await page.reload();
  await expect(page.locator('[data-profile-country-search]')).toHaveValue('POL');
  await expect(page.locator('[data-country-search-text]:visible')).toHaveCount(1);
});

test('final Show more in terminal details keeps keyboard focus in the country list',async({page})=>{
  await start(page,'/?lang=en&view=profile&clade=I&detail=formed&scope='+codes.join(','));
  await page.locator('[data-profile-inspector-disclosure] > summary').click();
  await page.locator('[data-profile-countries] > summary').click();
  await page.locator('[data-reveal-evidence="profile-countries"]').click();
  await expect(page.locator('[data-reveal-evidence="profile-countries"]')).toHaveCount(0);
  await expect(page.locator('[data-evidence-progress="profile-countries"]')).toBeFocused();
  await expect(page.locator('[data-country-search-text]:visible')).toHaveCount(codes.length);
});

for(const params of ['view=oops&presence=oops&crossing=oops','samples=oops','view=profile&clade=I&detail=formed',
  'view=country-overview&country=BAD','view=country&country=RUS&clade=I&scope=BAD']) {
  test(`invalid public link is corrected and disclosed: ${params}`,async({page})=>{
    await start(page,'/?lang=en&countries=RUS&'+params);
    await expect(page.locator('#workspace-link-note')).toBeVisible();
    await expect(page.locator('#workspace-link-note')).not.toHaveText('');
    await expect.poll(()=>decodeURIComponent(page.url())).not.toMatch(/oops|BAD|detail=formed/);
  });
}

test('outside dates keep one fixed scale and a clipped search window',async({page})=>{
  await start(page,'/?lang=en&countries=RUS&presence=any&target=10000&window=50000'); await ready(page);
  const axis=await page.locator('#axis-bce-end').innerText();
  for(const year of ['148051','298051']) {
    await page.locator('#target-year').fill(year);await page.locator('#target-year').press('Tab');await ready(page);
    await expect(page.locator('#axis-bce-end')).toHaveText(axis);
    await expect(page.locator('#target-slider')).toHaveValue('0');
  }
  await expect(page.locator('#target-outside-scale')).toBeVisible();
  const hit=await page.locator('.time-axis').evaluate(el=>({start:el.style.getPropertyValue('--hit-start'),end:el.style.getPropertyValue('--hit-end')}));
  expect(hit).toEqual({start:'0%',end:'0%'});
  await page.locator('#target-slider').focus();await page.locator('#target-slider').press('ArrowRight');
  await expect(page.locator('#target-outside-scale')).toBeHidden();
  await page.screenshot({path:'output/confirmed-audit/timeline.png',fullPage:true});
});

test('rapid typing builds a wide real-data matrix once after the final draft',async({page})=>{
  test.setTimeout(60000);
  await page.goto('/?lang=en&view=profile&clade=A0-T');
  await expect(page.locator('[data-profile-tree-search]')).toBeVisible();
  const timing=await page.evaluate(async()=>{
    const input=document.querySelector<HTMLInputElement>('[data-profile-tree-search]')!;
    const table=document.querySelector('[data-profile-tree-table]')!;
    let renders=0;
    const observer=new MutationObserver(()=>renders++);observer.observe(table,{childList:true});
    const handlers:number[]=[];
    for(const value of ['R','R-','R-M','R-M2','R-M26','R-M269','R']) {
      input.value=value;const start=performance.now();input.dispatchEvent(new Event('input',{bubbles:true}));
      handlers.push(performance.now()-start);await new Promise(resolve=>setTimeout(resolve,25));
    }
    const duringTyping=renders;
    await new Promise(resolve=>setTimeout(resolve,700));observer.disconnect();
    return {duringTyping,renders,maxInputHandlerMs:Math.max(...handlers)};
  });
  expect(timing.duringTyping).toBe(0);expect(timing.renders).toBe(1);
  expect(timing.maxInputHandlerMs).toBeLessThan(100);
  await expect(page.locator('[data-profile-tree-search]')).toHaveValue('R');
  console.log(JSON.stringify({wideMatrixInput:timing}));
});

for(const lang of ['en','ru']) test(`common-branch explanations match the preserved grouping rule in ${lang}`,async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await start(page,`/?lang=${lang}&countries=RUS,POL&presence=all&min=0&target=15000&window=300`);await ready(page);
  for(const subject of ['presence','density-counts']) {
    await page.locator(`[data-annotation="${subject}"]`).click();
    const note=page.locator('#context-annotation');
    await expect(note).toContainText(lang==='ru'?'верхняя ветвь':'upper branch');
    expect(await note.evaluate(el=>el.scrollHeight-el.clientHeight)).toBeLessThanOrEqual(1);
    await note.screenshot({path:`output/confirmed-audit/${subject}-${lang}.png`});
    await page.keyboard.press('Escape');
  }
});
