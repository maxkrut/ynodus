import { expect, test } from '@playwright/test';
import { layoutFixture, layoutQuery } from '../fixtures/layout.mjs';

for (const width of [390, 768, 1050, 1051, 1279, 1280, 1440, 2560]) test(`result values share reading axes at ${width}`, async ({ page }, info) => {
  const data = layoutFixture();
  data.nodes[2][2] = 5500;
  data.nodes[3][2] = 5450;
  data.ancientCounts = data.samples.map((s: number[], i: number) => i % 3 === 0 ? Math.min(1, s[2]) : 0);
  await page.route('**/data/hras-index.json', route => route.fulfill({ json: data }));
  await page.setViewportSize({ width, height: 1100 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(layoutQuery + '&crossing=1');
  await expect(page.locator('#export-csv')).toBeEnabled();
  await expect(page.locator('#result-body .formed-branch-summary-text').first()).toBeVisible();
  await expect(page.locator('#result-body .ancient-count-note')).toHaveCount(0);
  for (const locale of ['ru', 'en']) {
    await page.locator('#locale-switcher').selectOption(locale);
    const geometry = await page.locator('tr[data-result-role]').evaluateAll(rows => rows.map(row => {
      const centre = (element: Element) => { const r = element.getBoundingClientRect(); return r.top + r.height / 2; };
      const firstLine = (element: Element) => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let text = walker.nextNode();
        while (text && !text.textContent?.trim()) text = walker.nextNode();
        if (!text) return centre(element);
        const range = document.createRange(); range.selectNodeContents(text);
        const rect = range.getClientRects()[0];
        return rect.top + rect.height / 2;
      };
      const first = (selector: string) => [...row.querySelectorAll(selector)].find(e => e.getBoundingClientRect().width > 0)!;
      const primary = Object.fromEntries(['.row-macro-label', '.table-branch-identity', '.table-total strong',
        'td:nth-child(3) > .result-primary-value', '.pill-row .country-pill'].map(s => [s, firstLine(first(s))]));
      const points = Object.values(primary);
      if (row.getAttribute('data-result-role') === 'formed') {
        points.push(firstLine(first('td:nth-child(4) > .result-primary-value')));
        if (matchMedia('(min-width: 1280px)').matches) points.push(centre(first('.table-result-actions')));
      }
      const buttons = [...row.querySelectorAll('.table-result-actions .table-profile-action')].map(e => e.getBoundingClientRect());
      const lines: DOMRect[][] = [];
      for (const button of buttons) {
        const line = lines.find(line => line.every(other => button.top < other.bottom - 1 && button.bottom > other.top + 1));
        if (line) line.push(button); else lines.push([button]);
      }
      return { role: row.getAttribute('data-result-role'), primary, drift: Math.max(...points) - Math.min(...points),
        actionDrift: Math.max(...lines.map(line => Math.max(...line.map(b => b.top + b.height / 2)) - Math.min(...line.map(b => b.top + b.height / 2)))),
        outside: row.getBoundingClientRect().right > innerWidth + 1 };
    }));
    await info.attach(`geometry-${locale}`, { body: JSON.stringify(geometry), contentType: 'application/json' });
    await page.mouse.move(0, 0); await page.locator('#locale-switcher').blur();
    await page.locator('.results-zone').screenshot({ path: `output/result-alignment/${width}-${locale}.png` });
    await page.locator('#result-body tr[data-result-role]').first().screenshot({ path: `output/result-alignment/${width}-${locale}-row.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(geometry.every(g => !g.outside)).toBe(true);
    expect(geometry.every(g => g.actionDrift <= 1)).toBe(true);
    if (width >= 1051) expect(geometry.every(g => g.drift <= 2), JSON.stringify(geometry)).toBe(true);
    expect(await page.locator('#result-body .table-branch-identity').first().evaluate(element => element.getBoundingClientRect().height)).toBeLessThan(30);
    const actions = page.locator('#result-body tr[data-result-role]').first().locator('.table-result-actions');
    const scale = await page.evaluate(() => Number(getComputedStyle(document.documentElement).zoom));
    expect((await actions.locator('button').boundingBox())!.height).toBeGreaterThanOrEqual((width <= 760 ? 44 : 24) * scale - .1);
  }
  expect(errors).toEqual([]);
});
