import {expect,test,type Page} from '@playwright/test';
import {layoutFixture} from '../fixtures/layout.mjs';
const tab=(p:Page,view:string)=>p.locator(`.research-entrypoints [data-research-view="${view}"]`);
const back=(p:Page,panel:string)=>p.locator(`[data-research-panel="${panel}"] [data-research-back]`);
const identity=(p:Page)=>p.locator('#profile-content .profile-compact-header h3');
async function locale(p:Page,language:string){
  await expect(p.locator('#locale-switcher')).toHaveValue(language);
  await expect(p.locator('html')).toHaveAttribute('lang',language);
  expect(new URL(p.url()).searchParams.get('lang')).toBe(language);
}
function timeCountries(p:Page){
  expect(new URL(p.url()).searchParams.get('countries')?.split(',').sort()).toEqual(['RUS','UKR']);
}
async function addPoland(p:Page){
  const drawer=p.locator('.branch-country-filter-drawer');
  if(!await drawer.evaluate(el=>(el as HTMLDetailsElement).open))await drawer.locator('summary').first().click();
  const selector=p.locator('.branch-country-sidebar-picker');
  if(!await selector.evaluate(el=>(el as HTMLDetailsElement).open)) await selector.locator('summary').click();
  await p.locator('[data-branch-country-choice="POL"]').check();
  await p.locator('[data-branch-country-apply]').click();
  await expect(p).toHaveURL(/scope=POL%2CRUS|scope=POL,RUS/);
}
async function scope(p:Page){
  expect(new URL(p.url()).searchParams.get('scope')).toBe('POL,RUS');
  await expect(p.locator('[data-branch-country-choice="POL"]')).toBeChecked();
  await expect(p.locator('[data-branch-country-choice="RUS"]')).toBeChecked();
  await expect(p.locator('[data-branch-country-choice="UKR"]')).not.toBeChecked();
  timeCountries(p);
}
for(const width of [390,1440]) {
 test(`profile-country return keeps latest language and separate country scopes at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:1000});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/data/hras-index.json',r=>r.fulfill({json:layoutFixture()}));
  await page.goto('/?lang=ru&view=profile&clade=R-SYN-100&countries=RUS,UKR&min=0');
  await expect(identity(page)).toHaveText('R-SYN-100');
  const opener=page.locator('#profile-content [data-tree-node="R-SYN-100"] [data-country-evidence="RUS"]');
  await opener.click();
  await expect(back(page,'country')).toContainText('К профилю R-SYN-100');
  await addPoland(page);

  await page.locator('#locale-switcher').selectOption('en');
  await locale(page,'en');
  await page.locator('.country-all-profile').click();
  await expect(identity(page)).toHaveText('R-SYN-100');
  await expect(back(page,'profile')).toContainText('POL + RUS within R-SYN-100');
  await page.locator('#profile-workspace').screenshot({path:`output/research-navigation/all-countries-profile-${width}.png`});
  await expect(page.locator('.profile-country-search')).toBeHidden();
  await page.reload();
  await expect(identity(page)).toHaveText('R-SYN-100');
  await back(page,'profile').click();
  await expect(page.locator('.tree-sheet-matrix')).toHaveCount(1);
  await scope(page); await locale(page,'en');
  await page.locator('#locale-switcher').selectOption('ru');
  await back(page,'country').click();
  await expect(identity(page)).toHaveText('R-SYN-100');
  await expect(opener).toBeFocused();
  await expect(page.locator('.tree-sheet-matrix')).toHaveCount(1);
  await locale(page,'ru'); timeCountries(page);
  await page.goForward();
  await expect(page.locator('.branch-country-matrix')).toBeVisible();
  await scope(page); await locale(page,'ru');
  await page.locator('#country-evidence-content').screenshot({path:`output/research-navigation/profile-return-${width}.png`});
  expect(errors).toEqual([]);
 });
 test(`country workspace tab and back keep branch scope and latest language at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:1000});
  await page.route('**/data/hras-index.json',r=>r.fulfill({json:layoutFixture()}));
  await page.goto('/?lang=ru&view=country-overview&country=RUS&countries=RUS,UKR&min=0');
  await page.locator('[data-country-tree-search]').fill('R-SYN-100');
  const opener=page.locator('#country-overview-content [data-country-evidence-anchor="R-SYN-100"][data-country-evidence="RUS"]');
  await opener.click();
  await expect(back(page,'country')).toContainText('К обзору страны RUS');
  await addPoland(page);
  await page.locator('#locale-switcher').selectOption('en');
  await page.locator('.country-all-profile').click();
  await expect(identity(page)).toHaveText('R-SYN-100');
  await tab(page,'country-overview').click();
  await scope(page); await locale(page,'en');
  await expect(back(page,'country')).toContainText('Back to country overview RUS');
  await page.locator('#locale-switcher').selectOption('ru');
  await back(page,'country').click();
  await expect(page.locator('[data-country-tree-search]')).toHaveValue('R-SYN-100');
  await expect(opener).toBeFocused();
  await locale(page,'ru'); timeCountries(page);
  await page.reload();
  await expect(page.locator('[data-country-tree-search]')).toHaveValue('R-SYN-100');
  await locale(page,'ru');
  await tab(page,'profile').click();
  await expect(identity(page)).toHaveText('R-SYN-100');
  await expect(back(page,'profile')).toContainText('POL + RUS');
  await page.reload();
  await expect(back(page,'profile')).toContainText('POL + RUS');
  await back(page,'profile').click();
  await scope(page); await locale(page,'ru');
  await page.reload();
  await expect(page.locator('.branch-country-matrix [data-tree-node="R-SYN-100"] [data-branch-tree-selected]')).toHaveText('120');
  await scope(page); await locale(page,'ru');
 });
}
