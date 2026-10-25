import { expect, test } from "@playwright/test";
import { layoutFixture, layoutQuery } from "../fixtures/layout.mjs";

for (const width of [390, 1440]) {
  test(`dragging across linear and log keeps overview columns readable at ${width}`, async ({ page }) => {
    const data = layoutFixture();
    data.nodes.filter(node => node[1] === -1).forEach(node => { node[2] = 235900; });
    for (const age of [150000, 100000, 50000, 23500, 18000, 11950, 11949, 11900, 8000, 6500, 5500, 3000, 500]) {
      data.samples.push([data.nodes.length, 0, 10]);
      data.nodes.push([0, 0, age]);
      data.nodeIds.push(`R-SYN-DRAG-${age}`);
      data.countryCounts[0] += 10;
    }
    data.hrasManifestSampleCount = data.countryCounts.reduce((sum, count) => sum + count, 0);
    await page.setViewportSize({ width, height: 1000 });
    await page.route("**/data/hras-index.json", route => route.fulfill({ json: data }));
    await page.goto(layoutQuery);
    await expect(page.locator("#export-csv")).toBeEnabled();
    const slider = page.locator("#target-slider");
    for (const anchor of ["axis", "target"]) {
      await page.locator("#density-anchor").selectOption(anchor);
      let log = false, linear = false;
      for (const fraction of [.76, .61, .405, .399, .32, .2, .04, .99]) {
        await slider.scrollIntoViewIfNeeded();
        const box = (await slider.boundingBox())!;
        await page.mouse.move(box.x + box.width * .7, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * fraction, box.y + box.height / 2, { steps: 4 });
        await page.mouse.up();
        // An arbitrary slider date can legitimately have no exportable matches.
        await expect(page.locator("#live-status")).toHaveAttribute("data-busy", "false");
        const value = Number(await slider.inputValue());
        log ||= value < 8051; linear ||= value >= 8051;
        const chart = await page.locator("#target-density").evaluate(root => {
          const cells = [...root.querySelectorAll<HTMLElement>(".density-cell")];
          const expected = root.getBoundingClientRect().width * 300 / 20000;
          const regular = cells.slice(1, -1);
          return {
            count: cells.length,
            widthError: Math.max(...regular.map(cell => Math.abs(cell.getBoundingClientRect().width - expected))),
            total: [...root.querySelectorAll(".density-count")].reduce((sum, el) => sum + Number(el.textContent?.replace(/\s/g, "")), 0),
            overflow: document.documentElement.scrollWidth > innerWidth,
          };
        });
        expect(chart.count).toBeLessThanOrEqual(70);
        expect(chart.widthError).toBeLessThan(1);
        expect(chart.total).toBe(data.nodes.length);
        expect(chart.overflow).toBe(false);
        if (anchor === "target" && fraction === .32) {
          await page.mouse.move(0, 0);
          await page.locator(".timeline-zone").screenshot({ path: `output/density-intervals/drag-log-${width}.png` });
        }
      }
      expect({ log, linear }).toEqual({ log: true, linear: true });
    }
  });
}
