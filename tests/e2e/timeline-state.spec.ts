import { expect, test, type Page } from "@playwright/test";
import { compact } from "../../scripts/semantic-audit/fixtures.mjs";
import { densityMacroLabelsFixture } from "../fixtures/density-reading.mjs";

const ages = [235900, 150000, 100000, 50000, 18000, 12200, 11949, 11700, 7200, 6000, 5700, 5400, 3000];
function fixture() {
  const data = compact(ages.map(() => -1), ages, ages.flatMap((_, i) => [[i, 0, 10], [i, 1, 8]]));
  data.countryCodes = ["RUS", "POL", "FRA"];
  data.nodeIds = ages.map((_, i) => `SYN-TIMELINE-${i}`);
  data.projectIds = ["R1a", "R1b", "I2", "J2"];
  data.nodes.forEach((node, i) => { node[0] = i % 4; });
  return data;
}

test("narrow columns do not reserve rows for hidden group labels", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.route("**/data/hras-index.json", route => route.fulfill({ json: densityMacroLabelsFixture() }));
  await page.goto(query.replace("target=5700&window=400", "target=8600&window=300"));
  await ready(page);
  expect((await page.locator("#target-density").boundingBox())!.height).toBeLessThan(90);
  const column = page.locator('button.density-cell[data-target-ybp="15000"]');
  await expect(column).toHaveAttribute("aria-label", /GHIJK/);
  await column.focus();
  await expect(page.locator("#context-annotation")).toContainText("GHIJK");
  await page.keyboard.press("Escape");
  await page.locator(".timeline-zone").screenshot({ path: "output/timeline-audit/compact-labels-390.png" });
});
const query = "/?lang=ru&countries=RUS,POL&presence=all&target=5700&window=400&min=5";

async function ready(page: Page) {
  await expect(page.locator("#live-status")).toHaveAttribute("data-busy", "false");
  await expect(page.locator("#target-density")).toHaveAttribute("aria-busy", "false");
}

async function checkResult(page: Page) {
  await ready(page);
  const url = new URL(page.url());
  const target = Number(url.searchParams.get("target")), delta = Number(url.searchParams.get("window"));
  const expected = ages.filter(age => Math.abs(age - target) <= delta).length;
  await expect(page.locator('#result-body tr[data-result-role="formed"]')).toHaveCount(expected);
  expect(await page.locator(".density-cell.has-current-results .density-count").evaluateAll(nodes =>
    nodes.reduce((sum, node) => sum + Number(node.textContent), 0))).toBe(expected);
  const geometry = await page.locator("#target-density").evaluate(root => {
    const selected = [...root.querySelectorAll<HTMLElement>(".density-cell.has-current-results")];
    const ranges = [...root.querySelectorAll<HTMLElement>(".density-result-range")];
    const contains = (range: HTMLElement, cell: HTMLElement) => {
      const a = range.getBoundingClientRect(), b = cell.getBoundingClientRect();
      return b.left >= a.left - .5 && b.right <= a.right + .5;
    };
    return {
      covered: selected.every(cell => ranges.filter(range => contains(range, cell)).length === 1),
      noGaps: ranges.every(range => [...root.querySelectorAll<HTMLElement>(".density-cell:not(.has-current-results)")]
        .every(cell => !contains(range, cell))),
      passive: ranges.every(range => getComputedStyle(range).pointerEvents === "none"),
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  expect(geometry, page.url()).toEqual({ covered: true, noGaps: true, passive: true, overflow: false });
}

for (const width of [390, 1440]) {
  test(`timeline contours match dates and windows across linear and log at ${width}`, async ({ page }) => {
    test.setTimeout(60000);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.route("**/data/hras-index.json", route => route.fulfill({ json: fixture() }));
    await page.goto(query);
    await checkResult(page);
    await expect(page.locator(".density-result-range")).toHaveCount(1);
    await page.locator("#max-delta-ybp").fill("1600");
    await checkResult(page);
    await expect(page.locator(".density-result-range")).toHaveCount(2);
    for (const anchor of ["axis", "target"]) {
      await page.locator("#density-anchor").selectOption(anchor);
      for (const [age, delta] of [[5700, 0], [11949, 400], [18000, 300], [50000, 9000], [100000, 1000]]) {
        await page.locator("#target-year").fill(String(age - 1949));
        await page.locator("#max-delta-ybp").fill(String(delta));
        await checkResult(page);
        if (age === 11949 || age === 50000) {
          await page.mouse.move(0, 0);
          await page.locator(".timeline-zone").screenshot({ path: `output/timeline-audit/${anchor}-${age}-${width}.png` });
        }
      }
    }
    expect(errors).toEqual([]);
  });

  test(`dragging keeps pending context and rejects an older reply at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(() => {
      const original = Worker.prototype.postMessage;
      (window as any).heldTimelineQueries = [];
      Worker.prototype.postMessage = function(message: any) {
        if (message.type === "analyze" && (window as any).holdTimelineQueries) {
          (window as any).heldTimelineQueries.push(() => original.call(this, message));
          return;
        }
        return original.call(this, message);
      };
    });
    await page.route("**/data/hras-index.json", route => route.fulfill({ json: fixture() }));
    await page.goto(query);
    await checkResult(page);
    const density = page.locator("#target-density"), slider = page.locator("#target-slider");
    const height = (await density.boundingBox())!.height;
    const count = await density.locator("button").count();
    await page.evaluate(() => { (window as any).holdTimelineQueries = true; });
    await slider.scrollIntoViewIfNeeded();
    const box = (await slider.boundingBox())!;
    await page.mouse.move(box.x + box.width * .7, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * .22, box.y + box.height / 2, { steps: 4 });
    await expect(density).toHaveAttribute("aria-busy", "true");
    await expect(density).toHaveAttribute("inert", "");
    expect((await density.boundingBox())!.height).toBeCloseTo(height, 0);
    await expect(density.locator("button")).toHaveCount(count);
    await expect(density.locator(".density-result-range")).toHaveCount(0);
    await expect(page.locator("#target-density-summary")).toContainText("предыдущего расчёта");
    await expect(page.locator("#export-csv")).toBeDisabled();
    await page.locator(".timeline-zone").screenshot({ path: `output/timeline-audit/pending-log-${width}.png` });
    await page.mouse.up();
    await page.waitForFunction(() => (window as any).heldTimelineQueries.length === 1);
    await page.locator("#max-delta-ybp").fill("4000");
    await page.waitForFunction(() => (window as any).heldTimelineQueries.length === 2);
    await page.evaluate(() => { (window as any).holdTimelineQueries = false; (window as any).heldTimelineQueries[1](); });
    await checkResult(page);
    await expect(density).not.toHaveAttribute("inert");
    const finalChart = await density.innerHTML();
    await page.evaluate(() => (window as any).heldTimelineQueries[0]());
    await page.waitForTimeout(200);
    await checkResult(page);
    expect(await density.innerHTML()).toBe(finalChart);
  });
}
