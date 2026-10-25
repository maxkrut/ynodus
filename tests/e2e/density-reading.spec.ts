import fs from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { densityMacroLabelsFixture, densityReadingFixture } from '../fixtures/density-reading.mjs';
import { expectReadableText, measureTextStates } from './contrast-support';

const query = '/?view=time&lang=en&target=8600&window=300&min=5&presence=all&crossing=0&countries=RUS,POL';
async function start(page: Page, child = false, olderCount = 15) {
  await page.route('**/data/hras-index.json', route => route.fulfill({ json: densityReadingFixture(child, olderCount) }));
  await page.goto(query);
  await expect(page.locator('#export-csv')).toBeEnabled();
  await page.locator('#density-step').fill((page.viewportSize()?.width ?? 1280) <= 760 ? '2400' : '600');
  await page.locator('#density-step').press('Enter');
}

test('one subclade with many samples has a visible filled column and exact count', async ({ page }) => {
  await start(page);
  const column = page.locator('.density-cell.has-current-results');
  await expect(column).toHaveCount(1); await expect(column.locator('.density-count')).toHaveText('1');
  await expect(column.locator('.density-macro-letter')).toHaveText('R1a');
  await expect(column.locator('.density-macro-letter')).toBeVisible();
  expect(await column.locator('.density-bar').evaluate(el => parseFloat(getComputedStyle(el).minHeight))).toBeGreaterThanOrEqual(16);
  expect((await column.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(column).toHaveAttribute('aria-label', /Number of subclades: 1;.*Macro groups: R1a 1/);
  await expect(page.locator('#result-body tr[data-result-role]')).toHaveCount(1);
  await expect(page.locator('#result-body')).toContainText('R-SYN-FOUND');
  await expect(page.locator('#result-body')).toContainText(/2[\s,]?483/);
  await expect(page.locator('#target-density-summary')).toContainText('Subclades across the full timeline: 16');
  await expect(page.locator('[data-target-ybp="15000"] .density-macro-letter')).toHaveText(['I2', 'J2', 'R1a']);
  const geometry = await column.evaluate(element => {
    const bar = element.querySelector('.density-bar')!.getBoundingClientRect();
    const count = element.querySelector('.density-count')!.getBoundingClientRect();
    const label = element.querySelector('.density-macro-letter')!.getBoundingClientRect();
    return { barTop: bar.top, barBottom: bar.bottom, countBottom: count.bottom, labelTop: label.top };
  });
  expect(geometry.countBottom).toBeLessThan(geometry.barTop);
  expect(geometry.labelTop).toBeGreaterThan(geometry.barBottom);
  const readings = await measureTextStates(page, [
    { name: 'single-subclade count', control: column, text: column.locator('.density-count') },
    { name: 'macrogroup R letter', control: column, text: column.locator('.density-macro-letter') },
  ]);
  expectReadableText(readings);
});

test('clicking a column count moves the date, slider, URL and results immediately', async ({ page }) => {
  await start(page);
  const column = page.locator('button.density-cell').filter({ has: page.locator('.density-count').filter({ hasText: /^15$/ }) });
  const year = page.locator('#target-year'), slider = page.locator('#target-slider');
  const initialSlider = await slider.inputValue();
  await expect(column).toHaveAttribute('data-tooltip', /Macro groups: I2 5, J2 5, R1a 5/);
  await expect(column).toHaveAttribute('aria-label', /Go to date: 13,051 BCE/);
  await column.locator('.density-count').click();
  await expect(year).toHaveValue('13051'); await expect(slider).not.toHaveValue(initialSlider);
  await expect(page).toHaveURL(/target=15000/);
  await expect(page.locator('#export-csv')).toBeEnabled();
  await expect(page.locator('#result-body tr[data-result-role]')).toHaveCount(15);
  await expect(column).toBeFocused();
  await expect(page.locator('#target-density-inspector')).toHaveCount(0);
});

test('Enter and Space navigate from the column without losing keyboard focus', async ({ page }) => {
  test.setTimeout(45_000);
  await start(page);
  for (const [ybp, key, year, rows] of [['15000', 'Enter', '13051', 15], ['8600', 'Space', '6651', 1]] as const) {
    const column = page.locator(`button.density-cell[data-target-ybp="${ybp}"]`);
    await column.focus(); await page.keyboard.press(key);
    await expect(page.locator('#target-year')).toHaveValue(year);
    await expect(page.locator('#export-csv')).toBeEnabled();
    await expect(page.locator('#result-body tr[data-result-role]')).toHaveCount(rows);
    await expect(column).toBeFocused();
  }
});

test('a letter click after another column keeps only the latest query and blocks stale export', async ({ page }) => {
  await start(page);
  const pending = await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>('[data-target-ybp="15000"]')!.click();
    const disabled = document.querySelector<HTMLButtonElement>('#export-csv')!.disabled;
    document.querySelector<HTMLElement>('[data-target-ybp="8600"] .density-macro-letter')!.click();
    return disabled;
  });
  expect(pending).toBe(true);
  await expect(page.locator('#export-csv')).toBeEnabled();
  await expect(page.locator('#target-year')).toHaveValue('6651');
  await expect(page).toHaveURL(/target=8600/);
  await expect(page.locator('#result-body tr[data-result-role]')).toHaveCount(1);
  await expect(page.locator('#result-body')).toContainText('R-SYN-FOUND');
  const downloaded = page.waitForEvent('download'); await page.locator('#export-csv').click();
  const csv = await fs.readFile((await (await downloaded).path())!, 'utf8');
  expect(csv).toContain('R-SYN-FOUND'); expect(csv).not.toContain('SYN-OLD-');
});

test('a deliberate focus move during chart navigation is preserved after analysis', async ({ page }) => {
  await start(page);
  await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>('button[data-target-ybp="15000"]')!.click();
    document.querySelector<HTMLInputElement>('#min-result-samples')!.focus();
  });
  await expect(page.locator('#export-csv')).toBeEnabled();
  await expect(page.locator('#target-year')).toHaveValue('13051');
  await expect(page.locator('#min-result-samples')).toBeFocused();
});

test('connected same-age members are subclades in one matching branch', async ({ page }) => {
  await start(page, true);
  await expect(page.locator('#result-body tr[data-result-role]')).toHaveCount(1);
  await expect(page.locator('.density-cell.has-current-results .density-count')).toHaveText('2');
  await expect(page.locator('.density-cell.has-current-results')).toHaveAttribute('aria-label', /Subclades in matching branches: 2/);
  await expect(page.locator('#result-body')).toContainText(/2[\s,]?483/);
});

for (const width of [390, 1440]) test(`counts, segments and explanations remain readable at ${width}px in both locales`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 }); await start(page);
  for (const locale of ['ru', 'en',]) {
    await page.locator('#locale-switcher').selectOption(locale);
    const column = page.locator('.density-cell.has-current-results');
    await expect(column.locator('.density-macro-letter')).toBeVisible();
    for (const id of ['density-counts', 'density-groups', 'density-results']) {
      await page.locator(`[data-annotation="${id}"]`).click();
      await expect(page.locator('#context-annotation')).toBeVisible(); await page.keyboard.press('Escape');
    }
    const sizes = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth,
      buttons: [...document.querySelectorAll('button.density-cell')].map(e => e.getBoundingClientRect().height),
      letters: [...document.querySelectorAll('.density-macro-letter')].map(e => {
        const text = e.getBoundingClientRect(), cell = e.closest('.density-cell')!.getBoundingClientRect();
        const bar = e.closest('.density-cell')!.querySelector('.density-bar')!.getBoundingClientRect();
        const range = document.createRange(); range.selectNodeContents(e);
        return { left: text.left, right: text.right, cellLeft: cell.left, cellRight: cell.right,
          top: text.top, bottom: text.bottom, inside: e.classList.contains("density-letter-inside"), barTop: bar.top, barBottom: bar.bottom, content: range.getBoundingClientRect().width, width: text.width };
      }) }));
    expect(sizes.document).toBeLessThanOrEqual(sizes.viewport + 1);
    expect(sizes.buttons.every(height => height >= 44)).toBeTruthy();
    const baselines = await page.locator('button.density-cell .density-plot').evaluateAll(elements => elements.map(e => e.getBoundingClientRect().bottom));
    expect(Math.max(...baselines) - Math.min(...baselines)).toBeLessThanOrEqual(1);
    for (const size of sizes.letters) {
      expect(size.left).toBeGreaterThanOrEqual(size.cellLeft); expect(size.right).toBeLessThanOrEqual(size.cellRight);
      expect(size.inside).toBe(false);
      expect(size.top).toBeGreaterThan(size.barBottom);
      expect(size.content).toBeLessThanOrEqual(size.width);
    }
    await page.mouse.move(0, 0); await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await fs.mkdir('output/density-labels', { recursive: true });
    await page.screenshot({ path: `output/density-labels/${info.project.name}-${width}-${locale}.png`, fullPage: true });
  }
});

for (const width of [320, 390, 960, 1440]) test(`all thin segments and long group labels fit at ${width}px`, async ({ page }, info) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width, height: 1000 });
  await page.route('**/data/hras-index.json', route => route.fulfill({ json: densityMacroLabelsFixture() }));
  await page.goto(query); await expect(page.locator('#export-csv')).toBeEnabled();
  await page.locator('#density-step').fill(width <= 760 ? '2400' : width <= 1100 ? '1200' : '600');
  await page.locator('#density-step').press('Enter');
  const column = page.locator('[data-target-ybp="15000"]');
  const labels = column.locator('.density-macro-letter');
  const codes = ['R1a', 'A0-T', 'A00', 'GHIJK', 'HIJK', 'I2', 'IJK', 'J2'];
  await expect(labels).toHaveText(codes);
  const baselines = await page.locator('button.density-cell .density-plot').evaluateAll(elements => elements.map(e => e.getBoundingClientRect().bottom));
  expect(Math.max(...baselines) - Math.min(...baselines)).toBeLessThanOrEqual(1);
  for (const code of codes) {
    const label = labels.filter({ hasText: new RegExp(`^${code}$`) });
    await expect(label).toBeVisible(); await expect(column).toHaveAttribute('aria-label', new RegExp(`${code} `));
    const bounds = await label.evaluate(e => {
      const text = document.createRange(); text.selectNodeContents(e);
      const box = e.getBoundingClientRect(), cell = e.closest('.density-cell')!.getBoundingClientRect();
      return { content: text.getBoundingClientRect().width, width: box.width, right: box.right, cellRight: cell.right };
    });
    expect(bounds.content).toBeLessThanOrEqual(bounds.width); expect(bounds.right).toBeLessThanOrEqual(bounds.cellRight);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  const readings = await measureTextStates(page, codes.map(code => ({
    name: `macrogroup ${code}`, control: column, text: labels.filter({ hasText: new RegExp(`^${code}$`) }),
  })));
  expectReadableText(readings);
  await labels.filter({ hasText: /^GHIJK$/ }).click();
  await expect(page.locator('#target-year')).toHaveValue('13051');
  await expect(page.locator('#export-csv')).toBeEnabled();
  await expect(page.locator('#result-body tr[data-result-role]')).toHaveCount(47);
  await fs.mkdir('output/density-labels', { recursive: true });
  await page.screenshot({ path: `output/density-labels/${info.project.name}-thin-${width}.png`, fullPage: true });
  await page.locator('.timeline-zone').screenshot({ path: `output/density-labels/${info.project.name}-thin-${width}-timeline.png` });
});

test('unknown source ages do not turn into columns', async ({ page }) => {
  await start(page); await page.goto(query.replace('countries=RUS,POL', 'countries=FRA'));
  await expect(page.locator('#live-status')).toHaveAttribute('data-busy', 'false');
  await expect(page.locator('button.density-cell')).toHaveCount(0);
  await expect(page.locator('#target-density-summary')).toContainText('No subclades with a known formation-age estimate');
});

test('large interval counts fit mobile columns without rounding in both locales', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 }); await start(page, false, 1500);
  for (const locale of ['ru', 'en',]) {
    await page.locator('#locale-switcher').selectOption(locale);
    const number = page.locator('.density-count.wide');
    await expect(number).toHaveCount(1);
    const text = await number.textContent();
    expect(Number(text!.replace(/\D/g, ''))).toBe(1500);
    const sizes = await number.evaluate(element => {
      const range = document.createRange(); range.selectNodeContents(element);
      return { text: range.getBoundingClientRect().width, cell: element.getBoundingClientRect().width };
    });
    expect(sizes.text).toBeLessThanOrEqual(sizes.cell);
  }
});
