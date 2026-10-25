import { expect, test } from "@playwright/test";
import { compact } from "../../scripts/semantic-audit/fixtures.mjs";

// Both exact search endpoints, their outside neighbors, and the scale transition.
const ages = [235900, 15359, 15358, 15208, 15058, 15057, 100000, 50000, 11949, 6000];
const data = compact(ages.map(() => -1), ages, ages.map((_, i) => [i, 0, 2]));
data.countryCodes = ["AZE", "RUS", "POL"];
data.projectIds = ["R1a"];
data.nodeIds = ages.map((_, i) => `R-SYN-FOCUS-${i}`);

for (const width of [390, 1440, 2560]) {
  test(`selected column follows the common scale while search stays exact at ${width}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1100 });
    await page.route("**/data/hras-index.json", route => route.fulfill({ json: data }));
    await page.goto("/?lang=ru&countries=AZE&target=15208&window=150&min=0&presence=any");
    await expect(page.locator("#export-csv")).toBeEnabled();
    const rows = await page.locator("#result-body").innerHTML();
    await page.locator("#density-anchor").selectOption("target");
    await page.locator("#density-sync").check();
    const focus = page.locator("button.density-focused-interval");
    await expect(focus).toHaveAttribute("data-tooltip", /14.?128 до н. э. – 12.?437 до н. э./);
    await expect(focus).toHaveAttribute("data-tooltip", /Длительность: 1.?691 лет/);
    await expect(focus).toHaveAttribute("data-tooltip", /Субкладов: 5/);
    // The wider log column includes context outside the exact inclusive ±150 search.
    await expect(page.locator('#result-body tr[data-result-role="formed"]')).toHaveCount(3);
    expect(await page.locator("#result-body").innerHTML()).toBe(rows);
    for (const age of [15208, 50000, 100000, 11949, 6000, 15208]) {
      await page.locator("#target-year").fill(String(age - 1949));
      await expect(page.locator("#live-status")).toHaveAttribute("data-busy", "false");
      await expect(page.locator("#max-delta-ybp")).toHaveValue("150");
      const geometry = await focus.evaluate(cell => {
        const root = cell.closest("#target-density")!;
        const box = cell.getBoundingClientRect(), chart = root.getBoundingClientRect();
        const bar = cell.querySelector(".density-bar")!.getBoundingClientRect();
        const cells = [...root.querySelectorAll(".density-cell")];
        const regular = cells.slice(1, -1).map(el => el.getBoundingClientRect());
        const hit = root.querySelector(".density-hit-region")!.getBoundingClientRect();
        const axis = root.closest<HTMLElement>(".time-axis")!;
        const hitSpan = parseFloat(axis.style.getPropertyValue("--hit-end"))
          - parseFloat(axis.style.getPropertyValue("--hit-start"));
        return {
          widthError: Math.max(...regular.map(b => Math.abs(b.width - chart.width * 300 / 20000))),
          barRatio: bar.width / box.width,
          hitRatio: hit.width / box.width,
          exactHitRatio: chart.width * hitSpan / 100 / box.width,
          overlap: cells.filter(el => el !== cell).some(el => {
            const b = el.querySelector(".density-bar")!.getBoundingClientRect();
            return Math.min(b.right, bar.right) - Math.max(b.left, bar.left) > .25;
          }),
          total: [...root.querySelectorAll(".density-count")].reduce((sum, el) => sum + Number(el.textContent), 0),
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      expect(geometry.widthError).toBeLessThan(.15);
      expect(geometry.barRatio).toBeCloseTo(.8, 1);
      expect(geometry.overlap).toBe(false);
      expect(geometry.overflow).toBe(false);
      expect(geometry.total).toBe(ages.length);
      if (age > 11949) {
        expect(geometry.exactHitRatio).toBeLessThan(.25);
        // The two 1px borders remain visible when the window is subpixel on a phone.
        expect(geometry.hitRatio).toBeLessThan(.5);
      }
      if (age === 6000) {
        expect(geometry.hitRatio).toBeCloseTo(1, 1);
        await expect(focus).toHaveAttribute("data-tooltip", /Длительность: 300 лет/);
      }
      if (age === 11949) await expect(focus).toHaveAttribute("data-tooltip", /Логарифмический \/ линейный/);
    }
    expect(await page.locator("#result-body").innerHTML()).toBe(rows);
    // Without the link, changing the window moves only its overlay and result outlines.
    await page.locator("#density-sync").uncheck();
    const signature = () => page.locator(".density-cell").evaluateAll(cells => cells.map(cell => ({
      column: (cell as HTMLElement).style.gridColumn,
      parameters: (cell.getAttribute("data-tooltip") || "").split("\n").slice(0, 3),
      count: cell.querySelector(".density-count")?.textContent,
    })));
    const grid = await signature();
    await page.locator("#max-delta-ybp").fill("50");
    await expect(page.locator('#result-body tr[data-result-role="formed"]')).toHaveCount(1);
    expect(await signature()).toEqual(grid);
    await page.locator("#density-sync").check();
    await expect(page.locator("#density-step")).toHaveValue("100");
    expect(await signature()).not.toEqual(grid);
    await page.locator("#max-delta-ybp").fill("150");
    await expect(page.locator("#density-step")).toHaveValue("300");
    await expect(page.locator('#result-body tr[data-result-role="formed"]')).toHaveCount(3);
    await page.locator('#density-step').focus();
    await focus.focus();
    await expect(page.locator("#context-annotation")).toContainText(/1.?691 лет/);
    await page.keyboard.press("Escape");
    await page.mouse.move(0, 0);
    await page.locator(".timeline-zone").screenshot({ path: `output/density-uniform/selected-${width}.png` });
    await page.locator("#density-anchor").selectOption("axis");
    await expect(page.locator(".density-focused-interval")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
