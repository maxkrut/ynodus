import { expect, test, type Page } from '@playwright/test';
import { layoutFixture, layoutQuery, countryForestFixture } from '../fixtures/layout.mjs';
import {allResearchLevels} from './research-test-actions';

const profile = (page: Page) => page.locator('#profile-content h3').first();
const back = (page: Page, panel = 'profile') => page.locator(`[data-research-panel="${panel}"] [data-research-back]`);
const tab = (page: Page, view: string) => page.locator(`.research-entrypoints [data-research-view="${view}"]`);
async function start(page: Page, url = layoutQuery + '&crossing=1', fixture = layoutFixture()) {
  await page.route('**/data/hras-index.json', route => route.fulfill({ json: fixture }));
  await page.goto(url);
  await expect(page.locator('#export-csv')).toBeEnabled();
}
async function open(page: Page, id: string) {
  await page.locator('#profile-clade-search').fill(id);
  await page.locator('#profile-lookup button[type="submit"]').click();
  await expect(profile(page)).toHaveText(id);
}
async function country(page: Page) {
  await tab(page, 'country-overview').click();
  await page.locator('#country-overview-select').selectOption('RUS');
  await page.locator('#country-overview-form button[type="submit"]').click();
  await expect(page.locator('[data-country-tree-search]')).toBeVisible();
  await allResearchLevels(page);
}

test('navigation initializes when randomUUID is unavailable', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(crypto, 'randomUUID', { value: undefined }); });
  await start(page);
  await page.locator('#result-body [data-open-result-detail="R-SYN-100"]').click();
  await expect(profile(page)).toHaveText('R-SYN-100');
  await back(page).click();
  await expect(page.locator('#time-workspace')).toBeVisible();
});

for (const locale of ['ru', 'en']) test(`version-1 history namespace migrates without losing details or return in ${locale}`, async ({ page }) => {
  await start(page, layoutQuery.replace('lang=ru', `lang=${locale}`));
  await page.locator('#result-macrogroup-filter').selectOption('R');
  await page.locator('#result-head [data-table-sort="subclade"]').click();
  const rows = await page.locator('#result-body tr').allTextContents();
  await page.locator('#result-body [data-open-result-detail="R-SYN-100"]').click();
  await expect(profile(page)).toHaveText('R-SYN-100');
  const original = await page.evaluate(() => ({ owner: history.state.ynodusNavigation.owner, index: history.state.ynodusNavigation.index }));
  await page.addInitScript(() => {
    const state = { ...history.state };
    if (!state.ynodusNavigation) return;
    for (const key of Object.keys(state)) if (key.startsWith('ynodus')) {
      state[`legacyApp${key.slice(6)}`] = state[key]; delete state[key];
    }
    history.replaceState(state, '');
    sessionStorage.setItem('namespaceMigrationExercised', '1');
  });
  await page.reload();
  await expect(profile(page)).toHaveText('R-SYN-100');
  expect(await page.evaluate(() => sessionStorage.getItem('namespaceMigrationExercised'))).toBe('1');
  const restored = await page.evaluate(() => ({ owner: history.state.ynodusNavigation.owner, index: history.state.ynodusNavigation.index,
    legacy: Object.keys(history.state).some(key => key.startsWith('legacyApp')),
    detail: history.state.ynodusDetail, scope: history.state.ynodusScope }));
  expect(restored).toMatchObject({ ...original, legacy: false, detail: 'formed' });
  expect(restored.scope).toContain('RUS');
  await back(page).click();
  await expect(page.locator('#time-workspace')).toBeVisible();
  await expect(page.locator('#result-macrogroup-filter')).toHaveValue('R');
  expect(await page.locator('#result-body tr').allTextContents()).toEqual(rows);
  await page.goForward();
  await expect(profile(page)).toHaveText('R-SYN-100');
});

test('standalone fragment and choices survive contextual return and reload', async ({ page }) => {
  await start(page);
  await tab(page, 'profile').click();
  await expect(back(page)).toBeHidden();
  await page.locator('#profile-clade-search').fill('R-SYN-10');
  await page.locator('[data-profile-option="R-SYN-100"]').click();
  await expect(profile(page)).toHaveText('R-SYN-100');
  await expect(back(page)).toContainText('К поиску субклада');
  await page.reload();
  await expect(profile(page)).toHaveText('R-SYN-100');
  await expect(back(page)).toContainText('К поиску субклада');
  await back(page).click();
  await expect(page.locator('#profile-content')).toBeEmpty();
  await expect(page.locator('#profile-lookup')).toBeVisible();
  await expect(page.locator('#profile-clade-search')).toHaveValue('R-SYN-10');
  await expect(page.locator('[data-profile-option="R-SYN-100"]')).toBeVisible();
  await expect(back(page)).toBeHidden();
});

test('time filter, sort, focus and rows survive local inspection inside terminal details', async ({ page }) => {
  await start(page);
  await page.locator('#result-macrogroup-filter').selectOption('R');
  await page.locator('#result-head [data-table-sort="subclade"]').click();
  const rows = await page.locator('#result-body tr').allTextContents();
  const opener = page.locator('#result-body [data-open-result-detail="R-SYN-100"]');
  await opener.click();
  await expect(profile(page)).toHaveText('R-SYN-100');
  await page.locator('#profile-content [data-profile-select="R-SYN-200"]').click();
  await expect(page.locator('.profile-selected-summary h3')).toHaveText('R-SYN-200');
  await expect(page.locator('#profile-content [data-open-profile-subclade]')).toHaveCount(0);
  await expect(profile(page)).toHaveText('R-SYN-100');
  await expect(back(page)).toContainText('К результатам по времени');
  await back(page).click();
  await expect(page.locator('#time-workspace')).toBeVisible();
  await expect(page.locator('#result-macrogroup-filter')).toHaveValue('R');
  expect(await page.locator('#result-body tr').allTextContents()).toEqual(rows);
  await expect(opener).toBeFocused();
});

test('another searched profile returns to the previously visited profile', async ({ page }) => {
  await start(page);
  await tab(page, 'profile').click();
  await open(page, 'R-SYN-100');
  await open(page, 'I-SYN-100');
  await expect(back(page)).toContainText('К профилю R-SYN-100');
  await back(page).click();
  await expect(profile(page)).toHaveText('R-SYN-100');
  // The query typed in that profile is also restored, rather than silently normalized.
  await expect(page.locator('#profile-clade-search')).toHaveValue('I-SYN-100');
});

test('country scope, previous branch and overview search survive all-country profiles', async ({ page }) => {
  await start(page);
  await country(page);
  await page.locator('[data-country-tree-search]').fill('R-SYN-100');
  await page.locator('#country-overview-content [data-country-evidence-anchor="R-SYN-100"]').click();
  await expect(back(page, 'country')).toContainText('К обзору страны RUS');
  await page.locator('#country-evidence-content [data-country-evidence-anchor="R-SYN-201"]').first().click();
  await expect(back(page, 'country')).toContainText('К RUS внутри R-SYN-100');
  await back(page, 'country').click();
  await expect(page).toHaveURL(/clade=R-SYN-100/);
  await page.locator('#country-evidence-content [data-open-profile-subclade="R-SYN-100"]').click();
  await expect(profile(page)).toHaveText('R-SYN-100');
  await expect(back(page)).toContainText('К RUS внутри R-SYN-100');
  await back(page).click();
  await expect(page).toHaveURL(/view=country&.*from=overview/);
  await expect(tab(page, 'country-overview')).toHaveAttribute('aria-current', 'page');
  await back(page, 'country').click();
  await expect(page.locator('[data-country-tree-search]')).toHaveValue('R-SYN-100');
});

test('tabs keep their own origin while browser Back remains chronological', async ({ page }) => {
  await start(page);
  await tab(page, 'profile').click();
  await open(page, 'R-SYN-100');
  await expect(profile(page)).toHaveText('R-SYN-100');
  await country(page);
  await tab(page, 'profile').click();
  await expect(profile(page)).toHaveText('R-SYN-100');
  await expect(back(page)).toContainText('К поиску субклада');
  await page.goBack();
  await expect(page.locator('[data-country-tree-search]')).toBeVisible();
  await page.goForward();
  await expect(profile(page)).toHaveText('R-SYN-100');
  await back(page).click();
  await expect(page.locator('#profile-content')).toBeEmpty();
  await expect(page.locator('#profile-lookup')).toBeVisible();
  await expect(page).not.toHaveURL(/view=country/);
});

test('native Back then Forward preserves changed country-tree expansion and search', async ({ page }) => {
  await start(page);
  await country(page);
  const toggle = page.locator('[data-country-tree-toggle="R-SYN-ROOT"]');
  const changed = await toggle.getAttribute('aria-expanded') === 'true' ? 'false' : 'true';
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', changed);
  await page.goBack();
  await expect(page.locator('#country-overview-content')).toBeEmpty();
  await expect(page.locator('#country-overview-form')).toBeVisible();
  await page.goForward();
  await expect(toggle).toHaveAttribute('aria-expanded', changed);
  await page.locator('[data-country-tree-search]').fill('R-SYN-10');
  await page.goBack();
  await page.goForward();
  await expect(page.locator('[data-country-tree-search]')).toHaveValue('R-SYN-10');
});

test('large result reveal and scroll return to the same opener', async ({ page }) => {
  await start(page, '/?lang=ru&countries=RUS&presence=any&target=4500&window=10&min=0', countryForestFixture());
  await page.locator('#result-body [data-show-more-results]').click();
  const opener = page.locator('#result-body [data-open-result-detail="R-SYN-L060"]');
  await opener.scrollIntoViewIfNeeded();
  const y = await page.evaluate(() => window.scrollY);
  await opener.click();
  await expect(profile(page)).toHaveText('R-SYN-L060');
  await back(page).click();
  await expect(opener).toBeVisible();
  await expect(opener).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y - 3);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(y + 3);
});

test('mobile branch tree search and exact opener survive contextual return', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await country(page);
  await page.locator('[data-country-tree-search]').fill('R-SYN-100');
  await page.locator('#country-overview-content [data-country-evidence-anchor="R-SYN-100"]').click();
  const search = page.locator('[data-branch-tree-search]');
  await search.fill('R-SYN-201');
  const opener = page.locator('#country-evidence-content .profile-node-links [data-country-evidence-anchor="R-SYN-201"]');
  await opener.click();
  await expect(page).toHaveURL(/clade=R-SYN-201/);
  await back(page, 'country').click();
  await expect(page).toHaveURL(/clade=R-SYN-100/);
  await expect(search).toHaveValue('R-SYN-201');
  await expect(opener).toBeFocused();
});

test('native Forward restores focus to the country filter being edited', async ({ page }) => {
  await start(page);
  await page.locator('#result-body [data-open-result-detail="R-SYN-100"]').click();
  await expect(profile(page)).toHaveText('R-SYN-100');
  await page.locator('[data-profile-inspector-disclosure] > summary').click();
  await page.locator('[data-profile-countries] > summary').click();
  const filter = page.locator('[data-profile-country-search]');
  await filter.fill('RUS');
  await filter.focus();
  await page.goBack();
  await expect(page.locator('#time-workspace')).toBeVisible();
  await page.goForward();
  await expect(profile(page)).toHaveText('R-SYN-100');
  await expect(page.locator('[data-profile-inspector-disclosure]')).toHaveAttribute('open', '');
  await expect(page.locator('[data-profile-countries]')).toHaveAttribute('open', '');
  await expect(filter).toHaveValue('RUS');
  await expect(filter).toBeFocused();
});

test('mobile hidden country pills survive profile return', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  const row = page.locator('#result-body tr[data-result-role]').filter({ has: page.locator('[data-open-result-detail="R-SYN-100"]') });
  const details = row.locator('details');
  await details.locator('summary').click();
  await row.locator('[data-open-result-detail="R-SYN-100"]').click();
  await expect(profile(page)).toHaveText('R-SYN-100');
  await back(page).click();
  await expect(details).toHaveAttribute('open', '');
  await expect(details.locator('[data-country-pill-popover]')).not.toBeEmpty();
});

test('long previous profile names wrap inside the mobile return control', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = layoutFixture(), long = 'R-SYN-' + 'LONG'.repeat(20);
  fixture.nodeIds[1] = long;
  await start(page, layoutQuery + `&view=profile&clade=${long}`, fixture);
  await expect(profile(page)).toHaveText(long);
  await page.locator('#profile-content [data-open-profile-subclade="R-SYN-201"]').first().click();
  await expect(profile(page)).toHaveText('R-SYN-201');
  await expect(back(page)).toContainText(long);
  const box = await back(page).boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: `output/result-details/contextual-navigation/${info.project.name}-long-label.png` });
});

for (const lang of ['ru', 'en',]) for (const width of [390, 1440]) {
  test(`direct links have a local fallback with readable return labels ${lang} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await start(page, layoutQuery.replace('lang=ru', `lang=${lang}`) + '&view=profile&clade=R-SYN-100');
    await expect(profile(page)).toHaveText('R-SYN-100');
    const label = { ru: 'К поиску субклада', en: 'Back to subclade search', }[lang]!;
    await expect(back(page)).toContainText(label);
    const box = await back(page).boundingBox();
    const scale = await page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).zoom) || 1);
    expect(box!.height).toBeGreaterThanOrEqual((width <= 760 ? 44 : 44 * scale) - 0.1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `output/result-details/contextual-navigation/${info.project.name}-${lang}-${width}.png` });
    await back(page).click();
    await expect(page.locator('#profile-content')).toBeEmpty();
  await expect(page.locator('#profile-lookup')).toBeVisible();
    await expect(page.locator('#profile-clade-search')).toBeFocused();
    await expect(back(page)).toBeHidden();
  });
}

test('late profile completion preserves a newer lookup draft, options and input focus', async ({ page }) => {
  await page.addInitScript(() => {
    const pending: Array<() => void> = [];
    (window as any).holdProfile = false;
    (window as any).releaseProfile = () => { (window as any).holdProfile = false; pending.splice(0).forEach(deliver => deliver()); };
    const add = Worker.prototype.addEventListener;
    Worker.prototype.addEventListener = function(type: string, listener: any, options: any) {
      if (type !== 'message') return (add as any).call(this, type, listener, options);
      const worker = this;
      return (add as any).call(this, type, (event: MessageEvent) => {
        const deliver = () => typeof listener === 'function' ? listener.call(worker, event) : listener.handleEvent(event);
        if ((window as any).holdProfile && event.data?.type === 'subcladeProfile') {
          pending.push(deliver); (window as any).heldProfiles = pending.length;
        } else deliver();
      }, options);
    } as any;
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await tab(page, 'profile').click();
  await page.locator('#profile-clade-search').fill('SYN-10');
  await page.evaluate(() => { (window as any).holdProfile = true; });
  await page.locator('[data-profile-option="R-SYN-100"]').click();
  await expect.poll(() => page.evaluate(() => (window as any).heldProfiles)).toBe(1);
  await page.locator('#profile-clade-search').fill('SYN-20');
  await expect(page.locator('[data-profile-option="J-SYN-202"]')).toBeVisible();
  await page.locator('#profile-clade-search').focus();
  const options = await page.locator('[data-profile-option]').allTextContents();
  await page.evaluate(() => { (window as any).releaseProfile(); });
  await expect(profile(page)).toHaveText('R-SYN-100');
  await expect(page.locator('#profile-clade-search')).toHaveValue('SYN-20');
  await expect(page.locator('#profile-clade-search')).toBeFocused();
  expect(await page.locator('[data-profile-option]').allTextContents()).toEqual(options);
});
