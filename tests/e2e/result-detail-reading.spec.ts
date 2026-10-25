import { expect, test, type Page } from '@playwright/test';
import { layoutFixture } from '../fixtures/layout.mjs';
import { branchCountriesFixture } from '../fixtures/branch-countries.mjs';

async function openResult(page: Page, data: ReturnType<typeof layoutFixture>, target: number, id: string) {
  await page.route('**/data/hras-index.json', route => route.fulfill({ json: data }));
  await page.goto(`/?lang=ru&countries=${data.countryCodes.join(',')}&presence=any&target=${target}&window=0&min=0`);
  await page.locator(`[data-open-result-detail="${id}"]`).click();
  await expect(page.locator('#profile-content .profile-identity-main > h3')).toHaveText(id);
}

for (const width of [390, 640, 641, 768, 1440]) test(`result details put scope before the tree and keep a compact country list at ${width}`, async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    (window as any).readingAnalyses = 0;
    const send = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (message: any, ...args: any[]) {
      if (message.type === 'analyze') (window as any).readingAnalyses++;
      return (send as any).call(this, message, ...args);
    };
  });
  await openResult(page, layoutFixture(), 18000, 'R-SYN-ROOT');
  const content = page.locator('#profile-content');
  const inspector = content.locator('[data-profile-inspector]');
  const disclosure = inspector.locator('[data-profile-countries]');
  const originalCount = Number((await inspector.locator('.profile-selected-metric article > strong').innerText()).replace(/\D/g, ''));
  const analyses = await page.evaluate(() => (window as any).readingAnalyses);
  for (const locale of ['ru', 'en',]) {
    const formattedCount = new Intl.NumberFormat(locale).format(originalCount);
    const beforeLocale = await page.evaluate(() => (window as any).readingAnalyses);
    await page.locator('#locale-switcher').selectOption(locale);
    await expect(inspector.locator('.profile-selected-metric article > strong')).toHaveText(formattedCount);
    await expect(content.locator('.profile-ancestry, .profile-extra, [data-tree-age-pairs], .result-detail-age-coverage')).toHaveCount(0);
    await expect(disclosure).not.toHaveAttribute('open', '');
    await expect(disclosure.locator('.result-country-preview .fi')).toHaveCount(3);
    const geometry = await content.evaluate(el => {
      const inspector = el.querySelector('[data-profile-inspector]')!.getBoundingClientRect();
      const toolbar = el.querySelector('.result-detail-toolbar')!.getBoundingClientRect();
      const tree = el.querySelector('.profile-tree-section')!.getBoundingClientRect();
      const project = el.querySelector('.profile-identity-main > .profile-project')!.getBoundingClientRect();
      const title = el.querySelector('.profile-identity-main > h3')!.getBoundingClientRect();
      return { scopeBeforeControls: inspector.bottom <= toolbar.top + 1, controlsBeforeTree: toolbar.bottom <= tree.top + 1,
        identityAxis: Math.abs(project.top + project.height / 2 - title.top - title.height / 2),
        overflow: document.documentElement.scrollWidth - innerWidth };
    });
    expect(geometry.scopeBeforeControls, locale).toBe(true);
    expect(geometry.controlsBeforeTree, locale).toBe(true);
    expect(geometry.identityAxis, locale).toBeLessThanOrEqual(1);
    expect(geometry.overflow, locale).toBeLessThanOrEqual(0);
    if (width >= 641 && width <= 1050) {
      const sideBySide = await inspector.evaluate(el => {
        const metric = el.querySelector('.profile-selected-summary')!.getBoundingClientRect();
        const countries = el.querySelector('.country-evidence-list')!.getBoundingClientRect();
        return countries.left >= metric.right && Math.abs(countries.top - metric.top) < 1;
      });
      expect(sideBySide, locale).toBe(true);
    }
    if (locale === 'ru') {
      await content.screenshot({ path: `output/result-details/reading-${width}.png` });
    }
    await disclosure.locator('summary').press('Enter');
    await expect(disclosure).toHaveAttribute('open', '');
    await expect(disclosure.locator('.country-evidence-row:visible')).toHaveCount(12);
    await disclosure.locator('[data-profile-country-search]').fill('RUS');
    await expect(disclosure.locator('.country-evidence-row:visible')).toHaveCount(1);
    await disclosure.locator('[data-profile-country-search]').fill('');

    await expect(inspector).toBeVisible();
    await expect(content.locator('.tree-sheet-matrix')).toBeVisible();

    await expect(inspector).toBeVisible();
    await expect(disclosure).toHaveAttribute('open', '');
    expect(await page.evaluate(() => (window as any).readingAnalyses)).toBe(beforeLocale);
    await disclosure.locator('summary').click();
    await content.locator('[data-profile-select="R-SYN-100"]').click();
    await expect(inspector.locator('h3').first()).toHaveText('R-SYN-100');
    await expect(disclosure).not.toHaveAttribute('open', '');
    await content.locator('[data-profile-select="R-SYN-ROOT"]').click();
    await expect(inspector.locator('.profile-selected-metric article > strong')).toHaveText(formattedCount);
    expect(await page.evaluate(() => (window as any).readingAnalyses)).toBe(analyses);
  }
  await disclosure.locator('summary').click();
  await page.locator('#locale-switcher').selectOption('ru');
  await expect(disclosure).toHaveAttribute('open', '');
  await expect(inspector.locator('.profile-selected-metric article > strong')).toHaveText(new Intl.NumberFormat('ru').format(originalCount));
  await page.reload();
  await expect(disclosure).toHaveAttribute('open', '');
  await expect(inspector.locator('.profile-selected-metric article > strong')).toHaveText(new Intl.NumberFormat('ru').format(originalCount));
  expect(errors).toEqual([]);
});

test('details retain real ancestors and disclose missing source ages without an extra details block', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openResult(page, branchCountriesFixture(), 5500, 'R-SYN-ROOT');
  await expect(page.locator('.result-detail-age-coverage')).toContainText('3 из 4');
  await expect(page.locator('#profile-content .profile-extra')).toHaveCount(0);
  await page.locator('[data-research-back]:visible').click();
  await page.locator('#target-year').fill('3051');
  await page.locator('#target-year').press('Tab');
  await page.locator('[data-open-result-detail="R-SYN-A"]').click();
  await expect(page.locator('.profile-ancestry h3')).toHaveText('Предки');
  await expect(page.locator('.profile-ancestry nav')).toHaveText('R-SYN-ROOT');
  await expect(page.locator('.result-detail-age-coverage')).toHaveCount(0);
});

test('a real equal-age parent-child pair retains its explanation and grouped structure', async ({ page }) => {
  const data = branchCountriesFixture();
  data.nodes[1][2] = 5500;
  await openResult(page, data, 5500, 'R-SYN-ROOT');
  await expect(page.locator('[data-tree-age-pairs]')).toContainText('Пар с одной оценкой: 1');
  await expect(page.locator('.profile-formed-context')).toBeVisible();
  await expect(page.locator('.profile-same-formed-members')).toContainText('R-SYN-A');
});
