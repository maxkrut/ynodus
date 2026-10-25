import { expect, test } from '@playwright/test';
import { layoutFixture } from '../fixtures/layout.mjs';

for (const width of [340, 390, 768, 1101, 1280, 1440, 2560]) {
  test(`reference query blocks stay aligned and readable at ${width}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const data = layoutFixture();
    data.countryCodes = ['BGR', 'BIH', 'BLR', 'CZE', 'HRV', 'MKD', 'MNE', 'POL', 'RUS', 'SRB', 'SVK', 'SVN', 'UKR'];
    data.countryCounts = data.countryCodes.map((_, i) => data.samples.filter(s => s[1] === i).reduce((sum, s) => sum + s[2], 0));
    await page.setViewportSize({ width, height: 1100 });
    await page.route('**/data/hras-index.json', route => route.fulfill({ json: data }));
    await page.goto(`/?view=time&lang=ru&target=5449&window=300&min=5&presence=all&countries=${data.countryCodes.join(',')}&preset=slavic`);
    await expect(page.locator('#export-csv')).toBeEnabled();
    for (const locale of ['ru', 'en']) {
      await page.locator('#locale-switcher').selectOption(locale);
      const geometry = await page.evaluate(() => {
        const box = (element: Element) => element.getBoundingClientRect().toJSON();
        const blocks = [...document.querySelectorAll('.query-panel-block')].map(element => ({
          ...box(element), border: getComputedStyle(element).borderLeftWidth,
        }));
        const selectors = ['#selection-panel-toggle', '#sample-scope', '#target-year', '.delta-stepper',
          '#density-step', '#density-anchor', '#min-result-samples', '#presence-mode-toggle', '.query-binary-switch'];
        const controls = selectors.map(selector => {
          const element = document.querySelector(selector)!;
          return { selector, ...box(element), block: box(element.closest('.query-panel-block')!) };
        });
        return { blocks, controls, scale: Number(getComputedStyle(document.documentElement).zoom),
          overflow: document.documentElement.scrollWidth > innerWidth,
          labelsFit: [...document.querySelectorAll<HTMLElement>('[data-presence]')]
            .every(element => element.scrollWidth <= element.clientWidth + 1),
          sync: box(document.querySelector('.density-sync-control')!),
        };
      });
      await info.attach(`geometry-${locale}`, { body: JSON.stringify(geometry), contentType: 'application/json' });
      expect(geometry.overflow).toBe(false);
      expect(geometry.labelsFit).toBe(true);
      expect(geometry.blocks).toHaveLength(8);
      for (const control of geometry.controls) {
        expect(control.x).toBeGreaterThanOrEqual(control.block.x - 1);
        expect(control.right).toBeLessThanOrEqual(control.block.right + 1);
      }
      const heights = geometry.controls.map(control => control.height);
      expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(1);
      expect(geometry.sync.top).toBeGreaterThanOrEqual(geometry.controls[4].bottom);
      if (width >= 1280) {
        const tops = geometry.controls.map(control => control.top);
        expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(1);
        for (let i = 1; i < geometry.blocks.length; i++) {
          expect(geometry.blocks[i].x).toBeGreaterThanOrEqual(geometry.blocks[i - 1].right - 1);
          expect(parseFloat(geometry.blocks[i].border) * geometry.scale).toBeCloseTo(1, 1);
        }
        const countryShare = geometry.blocks[0].width / (geometry.blocks.at(-1)!.right - geometry.blocks[0].x);
        expect(countryShare).toBeGreaterThan(.19); expect(countryShare).toBeLessThan(.28);
        expect(geometry.blocks[0].width).toBeGreaterThan(geometry.blocks[2].width);
      }
      await page.mouse.move(0, 0);
      await page.locator('#locale-switcher').blur();
      await page.locator('.query-zone').screenshot({ path: `output/query-panel-layout/verified-${width}-${locale}.png` });
    }
    expect(errors).toEqual([]);
  });
}
