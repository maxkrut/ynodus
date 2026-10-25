import { expect, test } from '@playwright/test';
import { layoutFixture, layoutQuery } from '../fixtures/layout.mjs';

for (const width of [390, 760, 761, 768, 1050, 1051, 1279, 1280, 1440, 2560]) test(`result cells remain vertically centered at ${width}`, async ({ page }, info) => {
  const data = layoutFixture();
  data.nodes[2][2] = 5500;
  data.nodes[3][2] = 5450;
  data.ancientCounts = data.samples.map((s: number[], i: number) => i % 3 === 0 ? Math.min(1, s[2]) : 0);
  await page.route('**/data/hras-index.json', route => route.fulfill({ json: data }));
  await page.setViewportSize({ width, height: 1100 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(layoutQuery.replace('RUS,POL,UKR,DEU,FIN,GBR', data.countryCodes.join(',')) + '&crossing=1');
  await expect(page.locator('#export-csv')).toBeEnabled();
  await expect(page.locator('#result-body [data-result-composition]').first()).toBeVisible();
  await expect(page.locator('#result-body .ancient-count-note')).toHaveCount(0);
  for (const locale of ['ru', 'en']) {
    await page.locator('#locale-switcher').selectOption(locale);
    const groupedRow = page.locator('#result-body tr[data-result-role]').filter({ has: page.locator('[data-open-result-detail="R-SYN-100"]') });
    const moreCountries = groupedRow.locator('.chip-details:not([open]) > summary');
    if (await moreCountries.count()) await moreCountries.click();
    const geometry = await page.locator('tr[data-result-role]').evaluateAll(rows => rows.map(row => {
      const rowBox = row.getBoundingClientRect();
      const rowCentre = rowBox.top + rowBox.height / 2;
      const cells = [...row.querySelectorAll<HTMLTableCellElement>(':scope > td')].map(cell => {
        const blocks = [...cell.children].map(child => child.getBoundingClientRect()).filter(box => box.width > 0 && box.height > 0);
        if (!blocks.length) return null;
        const top = Math.min(...blocks.map(box => box.top));
        const bottom = Math.max(...blocks.map(box => box.bottom));
        return { column: cell.cellIndex, drift: Math.abs((top + bottom) / 2 - rowCentre) };
      }).filter(cell => cell !== null);
      const buttons = [...row.querySelectorAll('.table-result-actions .table-profile-action')].map(e => e.getBoundingClientRect());
      const lines: DOMRect[][] = [];
      for (const button of buttons) {
        const line = lines.find(line => line.every(other => button.top < other.bottom - 1 && button.bottom > other.top + 1));
        if (line) line.push(button); else lines.push([button]);
      }
      const actions = row.querySelector('.table-result-actions')!.getBoundingClientRect();
      const identity = row.querySelector('.table-branch-identity')?.getBoundingClientRect();
      const detail = row.querySelector('[data-open-result-detail]')!.getBoundingClientRect();
      const external = [...row.querySelectorAll('.table-yfull-action')].map(el => el.getBoundingClientRect());
      return { role: row.getAttribute('data-result-role'), cells, actionsCentreDrift: Math.abs(actions.top + actions.height / 2 - rowCentre),
        identityDrift: identity ? Math.abs(identity.top + identity.height / 2 - rowCentre) : 0,
        detailLeft: detail.left, externalLeft: external[0].left,
        crossingLinksDrift: external.length === 2 ? Math.abs(external[0].left - external[1].left) : 0,
        crossingDetailDrift: Math.abs(detail.top + detail.height / 2 - (external[0].top + external.at(-1)!.bottom) / 2),
        actionDrift: Math.max(...lines.map(line => Math.max(...line.map(b => b.top + b.height / 2)) - Math.min(...line.map(b => b.top + b.height / 2)))),
        outside: row.getBoundingClientRect().right > innerWidth + 1 };
    }));
    await info.attach(`geometry-${locale}`, { body: JSON.stringify(geometry), contentType: 'application/json' });
    await page.mouse.move(0, 0); await page.locator('#locale-switcher').blur();
    await page.locator('.results-zone').screenshot({ path: `output/result-alignment/${width}-${locale}.png` });
    await page.locator('#result-body tr[data-result-role]').first().screenshot({ path: `output/result-alignment/${width}-${locale}-row.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(geometry.every(g => !g.outside)).toBe(true);
    expect(geometry.filter(g => g.role === 'formed').every(g => g.actionDrift <= 1)).toBe(true);
    expect(geometry.filter(g => g.role === 'crossing').every(g => g.crossingLinksDrift <= 1 && g.crossingDetailDrift <= 1), JSON.stringify(geometry)).toBe(true);
    if (width >= 761) {
      expect(geometry.every(g => g.cells.length === 6)).toBe(true);
      expect(geometry.every(g => g.cells.every(cell => cell.drift <= 1)), JSON.stringify(geometry)).toBe(true);
    }
    if (width >= 1280) {
      expect(geometry.every(g => g.actionsCentreDrift <= 1 && g.identityDrift <= 1), JSON.stringify(geometry)).toBe(true);
      const formed = geometry.filter(g => g.role === 'formed');
      for (const key of ['detailLeft', 'externalLeft'] as const) expect(Math.max(...formed.map(g => g[key])) - Math.min(...formed.map(g => g[key]))).toBeLessThanOrEqual(1);
    }
    expect(await page.locator('#result-body .table-branch-identity').first().evaluate(element => element.getBoundingClientRect().height)).toBeLessThan(30);
    const actions = page.locator('#result-body tr[data-result-role]').first().locator('.table-result-actions');
    const scale = await page.evaluate(() => Number(getComputedStyle(document.documentElement).zoom));
    expect((await actions.locator('[data-open-result-detail]').boundingBox())!.height).toBeGreaterThanOrEqual((width <= 760 ? 44 : 24) * scale - .1);
  }
  expect(errors).toEqual([]);
});
