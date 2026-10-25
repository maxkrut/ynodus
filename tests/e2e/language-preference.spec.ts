import { expect, test, type Page } from '@playwright/test';
import { layoutFixture, layoutQuery } from '../fixtures/layout.mjs';

test.use({ locale: 'ru-RU' });
const query = new URL(layoutQuery, 'https://example.test');
query.searchParams.delete('lang');
const startUrl = query.pathname + query.search;

async function start(page: Page, url = startUrl) {
  await page.route('**/data/hras-index.json', route => route.fulfill({ json: layoutFixture() }));
  await page.goto(url);
  await expect(page.locator('#export-csv')).toBeEnabled();
}

test('fresh visits default to English without country requests or cookies', async ({ page, context }) => {
  const external: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (/^https?:$/.test(url.protocol) && !['127.0.0.1', 'localhost'].includes(url.hostname)) external.push(url.origin);
  });
  await start(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#locale-switcher')).toHaveValue('en');
  expect(await page.evaluate(() => localStorage.getItem('ynodus-locale'))).toBeNull();
  expect(await context.cookies()).toEqual([]);
  expect(external).toEqual([]);
});

test('manual Russian and English survive reload, fresh visits and stale link languages', async ({ page, context }) => {
  await start(page);
  await page.locator('#locale-switcher').selectOption('ru');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  expect(await page.evaluate(() => localStorage.getItem('ynodus-locale'))).toBe('ru');
  await page.reload();
  await expect(page.locator('#export-csv')).toBeEnabled();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await page.goto(startUrl + '&lang=en');
  await expect(page.locator('#export-csv')).toBeEnabled();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.locator('#workspace-link-note')).toBeHidden();
  await page.locator('#locale-switcher').selectOption('en');
  await page.goto(startUrl + '&lang=ru');
  await expect(page.locator('#export-csv')).toBeEnabled();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(await page.evaluate(() => localStorage.getItem('ynodus-locale'))).toBe('en');
  expect(await context.cookies()).toEqual([]);
});

test('a link language is honored without becoming a saved manual choice', async ({ page }) => {
  await start(page, startUrl + '&lang=ru');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  expect(await page.evaluate(() => localStorage.getItem('ynodus-locale'))).toBeNull();
  await page.goto(startUrl);
  await expect(page.locator('#export-csv')).toBeEnabled();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('invalid saved values and invalid link languages fall back to English', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ynodus-locale', 'fr'));
  await start(page, startUrl + '&lang=unsupported');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#workspace-link-note')).toBeVisible();
});

test('manual switching remains available when browser storage is blocked', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', {
    get() { throw new DOMException('Storage blocked', 'SecurityError'); },
  }));
  await start(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.locator('#locale-switcher').selectOption('ru');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await page.locator('#locale-switcher').selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
