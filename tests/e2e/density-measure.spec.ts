import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { compact } from '../../scripts/semantic-audit/fixtures.mjs';

const ages = [235900, 48000, 47999, 47998, 7000];
const data = compact(ages.map(() => -1), ages, ages.map((_, i) => [i, 0, 2]));
data.countryCodes = ['RUS', 'POL', 'DEU'];
data.projectIds = ['R1a'];
data.nodeIds = ages.map((_, i) => `R-SYN-MEASURE-${i}`);
const query = '/?lang=ru&countries=RUS&target=7000&window=150&min=0&presence=any';

test('normalization changes height and units while preserving query, table and CSV', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    (window as any).measurePosts = 0;
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (...args) {
      (window as any).measurePosts++;
      return Reflect.apply(post, this, args);
    };
  });
  await page.route('**/data/hras-index.json', route => route.fulfill({ json: data }));
  await page.goto(query);
  await expect(page.locator('#export-csv')).toBeEnabled();
  const count = page.locator('[data-density-measure="count"]');
  const rate = page.locator('[data-density-measure="per1000"]');
  await expect(count).toHaveAttribute('aria-pressed', 'true');
  const older = page.locator('button.density-cell[data-target-ybp="48000"]');
  const recent = page.locator('button.density-cell[data-target-ybp="7000"]');
  const barHeight = async (cell: typeof older) => (await cell.locator('.density-bar').boundingBox())!.height;
  expect(await barHeight(older)).toBeGreaterThan(await barHeight(recent));
  const table = await page.locator('#result-body').innerHTML();
  const posts = await page.evaluate(() => (window as any).measurePosts);
  const url = page.url();
  async function csv() {
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#export-csv').click()]);
    return readFile((await download.path())!, 'utf8');
  }
  const beforeCsv = await csv();
  await rate.click();
  await expect(rate).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.density-height-caption')).toContainText('на 1');
  expect(Number(await older.getAttribute('data-density-value'))).toBeCloseTo(3000 / 5331, 8);
  expect(Number(await recent.getAttribute('data-density-value'))).toBeCloseTo(1000 / 300, 8);
  await expect(older.locator('.density-count')).toHaveText('0,6');
  await expect(recent.locator('.density-count')).toHaveText('3,3');
  expect(await barHeight(older) / await barHeight(recent)).toBeCloseTo(900 / 5331, 2);
  await expect(older).toHaveAttribute('data-tooltip', /На 1 000 лет: 3 ÷ 5.?331 × 1 000 = 0,563/);
  await expect(page.locator('button[data-target-ybp="235900"] .density-count')).toHaveText('<0,1');
  expect(await page.locator('.density-cell.empty .density-bar').evaluateAll(bars => bars.every(b => b.getBoundingClientRect().height === 0))).toBe(true);
  expect(await page.locator('#result-body').innerHTML()).toBe(table);
  expect(await csv()).toBe(beforeCsv);
  expect(await page.evaluate(() => (window as any).measurePosts)).toBe(posts);
  expect(page.url()).toBe(url);
  await count.click();
  await expect(older.locator('.density-count')).toHaveText('3');
  expect(await barHeight(older)).toBeGreaterThan(await barHeight(recent));
  await rate.focus(); await page.keyboard.press('Space');
  for (const locale of ['en', 'ru']) {
    await page.locator('#locale-switcher').selectOption(locale);
    await expect(rate).toHaveAttribute('aria-pressed', 'true');
  }
  await page.reload();
  await expect(rate).toHaveAttribute('aria-pressed', 'true');
  await expect(recent.locator('.density-count')).toHaveText('3,3');
  const step = page.locator('#density-step');
  await page.locator('#density-anchor').selectOption('target');
  await step.fill('1000000'); await step.press('Enter');
  const single = page.locator('button.density-cell');
  await expect(single).toHaveCount(1);
  expect(Number(await single.getAttribute('data-density-value'))).toBeCloseTo(5000 / 235900, 8);
  expect(await single.evaluate(cell => (cell as HTMLElement).style.getPropertyValue('--density-height'))).toBe('100%');
  await step.fill('300'); await step.press('Enter');
  await page.locator('#density-anchor').selectOption('target');
  await page.locator('#target-year').fill('46051');
  await expect(page.locator('#live-status')).toHaveAttribute('data-busy', 'false');
  await expect(page.locator('.density-focused-interval')).toHaveAttribute('data-tooltip', /Участок шкалы: Логарифмический/);
  await expect(page.locator('.density-focused-interval')).toHaveAttribute('data-tooltip', /На 1 000 лет:/);
});

test('height control fits phone and desktop in all locales', async ({ page }) => {
  test.setTimeout(60000);
  await page.route('**/data/hras-index.json', route => route.fulfill({ json: data }));
  await page.goto(query);
  await expect(page.locator('#export-csv')).toBeEnabled();
  await page.locator('[data-density-measure="per1000"]').click();
  for (const width of [340, 390, 760, 761, 1440, 2560]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const locale of ['ru', 'en',]) {
      await page.locator('#locale-switcher').selectOption(locale);
      const geometry = await page.locator('.density-measure-control').evaluate(control => {
        const box = control.getBoundingClientRect();
        const buttons = [...control.querySelectorAll('button[data-density-measure]')].map(button => button.getBoundingClientRect());
        const scale = Number(getComputedStyle(document.documentElement).zoom);
        return { overflow: document.documentElement.scrollWidth > innerWidth,
          outside: box.left < 0 || box.right > innerWidth,
          overlap: buttons[0].right > buttons[1].left + 1,
          scaledMinimum: innerWidth > 760 || buttons.every(b => b.height >= 44 * scale - .5) };
      });
      expect(geometry, `${width}/${locale}`).toEqual({ overflow: false, outside: false, overlap: false, scaledMinimum: true });
      if (locale === 'ru' && [390, 1440].includes(width)) {
        await page.mouse.move(0, 0);
        await page.locator('.timeline-zone').screenshot({ path: `output/density-measure/rate-${width}.png` });
      }
    }
  }
});
