import { expect, test, type Page } from '@playwright/test';
import { layoutFixture, layoutQuery } from '../fixtures/layout.mjs';

async function start(page: Page) {
  await page.route('**/data/hras-index.json', route => route.fulfill({json:layoutFixture()}));
  await page.addInitScript(() => {
    (window as any).navigationAnalyses = 0;
    const send = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function(message: any, ...args: any[]) {
      if (message?.type === 'analyze') (window as any).navigationAnalyses += 1;
      return (send as any).call(this, message, ...args);
    };
  });
  await page.goto(layoutQuery + '&crossing=1');
  await expect(page.locator('#result-body tr[data-result-role]')).toHaveCount(15);
  await expect(page.locator('#export-csv')).toBeEnabled();
}

async function search(page: Page, id: string) {
  await page.locator('#profile-clade-search').fill(id);
  await page.locator('#profile-lookup button[type="submit"]').click();
  await expect(page.locator('#profile-content h3').first()).toHaveText(id);
}

async function rows(page: Page, selector = '#result-body tr[data-result-role]') {
  return page.locator(selector).evaluateAll(items => items.map(row =>
    row.textContent?.replace(/\s+/g, ' ').trim()));
}

test('Back restores the empty standalone subclade search, then Forward restores the profile', async ({page}) => {
  await start(page);
  await page.locator('.research-entrypoints [data-research-view="profile"]').click();
  await expect(page.locator('#profile-content')).toBeEmpty();
  await expect(page.locator('#profile-lookup')).toBeVisible();
  await search(page, 'R-SYN-100');
  await page.goBack();
  await expect(page).not.toHaveURL(/clade=/);
  await expect(page.locator('#profile-content')).toBeEmpty();
  await expect(page.locator('#profile-lookup')).toBeVisible();
  await expect(page.locator('#profile-content h3')).toHaveCount(0);
  await expect(page.locator('#profile-clade-search')).toHaveValue('R-SYN-100');
  await page.goForward();
  await expect(page.locator('#profile-content h3').first()).toHaveText('R-SYN-100');
});

test('Back restores the country overview before choosing a country', async ({page}) => {
  await start(page);
  await page.locator('.research-entrypoints [data-research-view="country-overview"]').click();
  await expect(page.locator('#country-overview-content')).toBeEmpty();
  await expect(page.locator('#country-overview-form')).toBeVisible();
  await page.locator('#country-overview-select').selectOption('RUS');
  await page.locator('#country-overview-form button[type="submit"]').click();
  await expect(page.locator('#country-overview-content .profile-compact-identity')).toContainText('RUS');
  await page.goBack();
  await expect(page).not.toHaveURL(/[?&]country=/);
  await expect(page.locator('#country-overview-content')).toBeEmpty();
  await expect(page.locator('#country-overview-form')).toBeVisible();
  await expect(page.locator('[data-country-tree-search]')).toHaveCount(0);
  await page.goForward();
  await expect(page.locator('#country-overview-content .profile-compact-identity')).toContainText('RUS');
});

test('Back from an all-country profile restores the country overview origin', async ({page}) => {
  await start(page);
  await page.locator('.research-entrypoints [data-research-view="country-overview"]').click();
  await page.locator('#country-overview-select').selectOption('RUS');
  await page.locator('#country-overview-form button[type="submit"]').click();
  await page.locator('[data-country-tree-search]').fill('R-SYN-100');
  await page.locator('#country-overview-content [data-country-evidence-anchor="R-SYN-100"]').click();
  await expect(page.locator('#country-evidence-workspace [data-back-to-profile]')).toContainText('К обзору страны RUS');
  await page.locator('#country-evidence-content [data-open-profile-subclade="R-SYN-100"]').click();
  await expect(page.locator('#profile-content h3').first()).toHaveText('R-SYN-100');
  await page.goBack();
  await expect(page).toHaveURL(/from=overview/);
  await expect(page.locator('#country-evidence-workspace [data-back-to-profile]')).toContainText('К обзору страны RUS');
  await page.locator('#country-evidence-workspace [data-back-to-profile]').click();
  await expect(page.locator('#country-overview-content .profile-compact-identity')).toContainText('RUS');
});

test('profile Back preserves the committed time result without requesting another analysis', async ({page}) => {
  await start(page);
  const count = await page.evaluate(() => (window as any).navigationAnalyses);
  const formed = await rows(page);
  const crossings = await rows(page, '#crossing-result-body tr[data-result-role]');
  await page.locator('#result-body [data-open-result-detail="R-SYN-100"]').click();
  await expect(page.locator('#profile-content h3').first()).toHaveText('R-SYN-100');
  await page.locator('#profile-content [data-profile-select="R-SYN-200"]').click();
  await expect(page.locator('.profile-selected-summary h3')).toHaveText('R-SYN-200');
  await page.goBack();
  await expect(page.locator('#time-workspace')).toBeVisible();
  await expect(page.locator('#export-csv')).toBeEnabled();
  // The old restoration queued analysis with a debounce; allow that timer to fire.
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => (window as any).navigationAnalyses)).toBe(count);
  expect(await rows(page)).toEqual(formed);
  expect(await rows(page, '#crossing-result-body tr[data-result-role]')).toEqual(crossings);
});

test('Back restores a changed time query and its previous results', async ({page}) => {
  await start(page);
  const originalYear = await page.locator('#target-year').inputValue();
  const originalRows = await rows(page);
  const count = await page.evaluate(() => (window as any).navigationAnalyses);
  await page.locator('.research-entrypoints [data-research-view="profile"]').click();
  await search(page, 'R-SYN-100');
  await expect(page.locator('#profile-content h3').first()).toHaveText('R-SYN-100');
  await page.locator('.research-entrypoints [data-research-view="time"]').click();
  await page.locator('#target-year').fill('5000');
  await page.locator('#target-year').blur();
  await expect(page.locator('#export-csv')).toBeEnabled();
  await expect.poll(() => page.evaluate(() => (window as any).navigationAnalyses)).toBeGreaterThan(count);
  await page.goBack();
  await expect(page.locator('#profile-content h3').first()).toHaveText('R-SYN-100');
  await expect(page.locator('#target-year')).toHaveValue(originalYear);
  await expect(page.locator('#export-csv')).toBeEnabled();
  await expect(page.locator('#result-body tr[data-result-role]')).toHaveCount(15);
  expect(await rows(page)).toEqual(originalRows);
  await page.goForward();
  await expect(page.locator('#time-workspace')).toBeVisible();
  await expect(page.locator('#target-year')).toHaveValue('5000');
});
