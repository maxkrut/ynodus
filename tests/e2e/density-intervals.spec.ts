import { expect, test } from "@playwright/test";
import { layoutFixture, layoutQuery } from "../fixtures/layout.mjs";

for (const width of [390, 1440]) {
  test(`chart intervals are independent of query and lead the tooltip at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(() => {
      const root = window as typeof window & { workerPosts: number };
      root.workerPosts = 0;
      const post = Worker.prototype.postMessage;
      Worker.prototype.postMessage = function (...args) {
        root.workerPosts++;
        return Reflect.apply(post, this, args);
      };
    });
    await page.route("**/data/hras-index.json", route => route.fulfill({ json: layoutFixture() }));
    await page.goto(layoutQuery);
    await expect(page.locator("#export-csv")).toBeEnabled();
    const step = page.locator("#density-step");
    await expect(step).toHaveValue("300");
    const rows = await page.locator("#result-body").innerText();
    const beforePosts = await page.evaluate(() => (window as typeof window & { workerPosts: number }).workerPosts);
    for (const value of ["300", "725", "2400"]) {
      await step.fill(value); await step.press("Enter");
      expect(await page.locator(".density-count").allTextContents().then(values => values.reduce((sum, s) => sum + Number(s.replace(/\s/g, "")), 0))).toBe(102);
      expect(await page.locator("#result-body").innerText()).toBe(rows);
      await expect(page.locator("#export-csv")).toBeEnabled();
    }
    expect(await page.evaluate(() => (window as typeof window & { workerPosts: number }).workerPosts)).toBe(beforePosts);
    const signature = () => page.locator("button.density-cell").evaluateAll(cells => cells.map(cell => ({
      parameters: (cell.getAttribute("data-tooltip") || "").split("\n").slice(0, 3),
      count: cell.querySelector(".density-count")?.textContent,
    })));
    const initial = await signature();
    await page.locator("#target-year").fill("3600");
    await expect(page.locator("#export-csv")).toBeEnabled();
    expect(await signature()).toEqual(initial);
    await page.locator("#max-delta-ybp").fill("600");
    await expect(page.locator("#export-csv")).toBeEnabled();
    expect(await signature()).toEqual(initial);
    await page.setViewportSize({ width: width === 390 ? 1440 : 390, height: 1000 });
    await expect(step).toHaveValue("2400");
    expect(await signature()).toEqual(initial);
    await page.setViewportSize({ width, height: 1000 });
    await page.locator("button.density-cell").first().hover();
    const panel = page.locator("#context-annotation");
    await expect(panel).toBeVisible();
    expect((await panel.locator("dt").allTextContents()).slice(0, 3)).toEqual(["Диапазон", "Длительность", "Участок шкалы"]);
    await panel.screenshot({ path: `output/density-intervals/parameters-${width}.png` });
    await page.keyboard.press("Escape");
    await page.mouse.move(0, 0);
    await page.locator(".timeline-zone").screenshot({ path: `output/density-intervals/chart-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.reload();
    await expect(step).toHaveValue("2400");
    for (const locale of ["en", "ru"]) {
      await page.locator("#locale-switcher").selectOption(locale);
      await expect(step).toHaveValue("2400");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
}

test('date-centred grid, search-window link and manual step restoration', async ({ page }) => {
  await page.route("**/data/hras-index.json", route => route.fulfill({ json: layoutFixture() }));
  await page.goto(layoutQuery);
  await expect(page.locator("#export-csv")).toBeEnabled();
  const step = page.locator("#density-step"), anchor = page.locator("#density-anchor"), sync = page.locator("#density-sync");
  const table = await page.locator("#result-body").innerText();
  await step.fill("725"); await step.press("Enter");
  await anchor.selectOption("target");
  expect(await page.locator("#result-body").innerText()).toBe(table);
  await expect(page.locator(".density-focused-interval")).toHaveCount(1);
  await expect(page.locator(".density-focused-interval")).toHaveAttribute("data-tooltip", /Длительность: 725 лет/);
  await sync.check();
  await expect(step).toBeDisabled(); await expect(step).toHaveValue("200");
  await expect(page.locator(".density-focused-interval")).toHaveAttribute("data-tooltip", /Длительность: 200 лет/);
  await page.locator("#max-delta-ybp").fill("300");
  await expect(page.locator("#export-csv")).toBeEnabled();
  await expect(step).toHaveValue("600");
  const before = await page.locator(".density-focused-interval").getAttribute("data-tooltip");
  await page.locator("#target-year").fill("3650");
  await expect(page.locator("#export-csv")).toBeEnabled();
  await expect(page.locator(".density-focused-interval")).not.toHaveAttribute("data-tooltip", before!);
  await page.locator("#target-year").fill("16051"); // 18,000 YBP, in the log section.
  await expect(page.locator("#export-csv")).toBeEnabled();
  await expect(page.locator(".density-focused-interval")).toHaveAttribute("data-tooltip", /Участок шкалы: Логарифмический/);
  await expect(page.locator(".density-focused-interval")).not.toHaveAttribute("data-tooltip", /Длительность: 600 лет/);
  await expect(page.locator("#max-delta-ybp")).toHaveValue("300");
  await page.reload(); await expect(step).toHaveValue("600"); await expect(sync).toBeChecked(); await expect(anchor).toHaveValue("target");
  await page.locator("#max-delta-ybp").fill("0");
  await expect(page.locator("#density-settings-status")).toContainText("±0");
  await expect(page.locator("button.density-cell")).toHaveCount(0);
  await sync.uncheck(); await expect(step).toHaveValue("725"); await expect(step).toBeEnabled();
  await expect(page.locator("#density-settings-status")).toBeHidden();
  await step.fill("1"); await step.press("Enter");
  await expect(page.locator("#density-settings-status")).toBeVisible();
  await step.fill("300"); await step.press("Enter");
  await expect(page.locator("#density-settings-status")).toBeHidden();
});
