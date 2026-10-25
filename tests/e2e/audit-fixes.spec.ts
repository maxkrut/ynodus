import { populatedTimeUrl } from "../fixtures/time-url";
import fs from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { compact } from "../../scripts/semantic-audit/fixtures.mjs";

const evidenceDir = "output/audit-fixes";

test("audit fixes: minimum samples is explained, applied, and exported consistently", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = compact([-1], [5500], [[0, 0, 5], [0, 1, 6]]);
  fixture.countryCodes = ["RUS", "POL", "UKR"];
  fixture.projectIds = ["R"];
  fixture.nodeIds = ["R-SYN-MIN"];
  await page.route("**/data/hras-index.json", route => route.fulfill({ json: fixture }));
  await page.goto("/?lang=ru&countries=RUS,POL&presence=all&target=5500&window=300&min=5");
  await expect(page.locator("#export-csv")).toBeEnabled();

  const minimum = page.locator("#min-result-samples");
  const description = page.locator("#min-result-samples-description");
  await expect(description).toBeVisible();
  await expect(description).toContainText("минимум в окне таблицы и отдельно в каждом баре");
  await expect(minimum).toHaveAttribute("aria-describedby", "min-result-samples-description");

  await minimum.fill("999999");
  await expect(page.locator("#country-minimum-reset-note")).toContainText("Ни одна из выбранных стран не набрала минимум (999999)");
  await expect(page.locator("#presence-mode-toggle")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("#result-body tr[data-result-role]")).toHaveCount(0);
  await expect(minimum).toBeEnabled();
  await expect(page).toHaveURL(/presence=all/);
  await page.locator("[data-accept-country-minimum]").click();
  await expect(page.locator("#presence-mode-toggle")).toHaveAttribute("aria-checked", "false");
  await expect(minimum).toBeDisabled();
  await expect(description).toContainText("минимум не применяется");
  await expect(page).toHaveURL(/presence=any/);
  await expect(page.locator("#result-body tr[data-result-role]").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("#export-csv")).toBeEnabled();
  await expect(page.locator("#result-body tr[data-result-role]").first().locator(".country-pills-viewport"))
    .toHaveCount(1);
  const downloaded = page.waitForEvent("download");
  await page.locator("#export-csv").click();
  const csv = await fs.readFile((await (await downloaded).path())!, "utf8");
  expect(csv).toContain("R-SYN-MIN");
  expect(csv).toContain("not_applied_in_all_branches_mode");
  await page.screenshot({ path: "output/minimum-reset/high-minimum-390-ru.png", fullPage: true });
});

test("audit fixes: expanded selections and the source header stay bounded", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const snapshotResponse = page.waitForResponse("**/data/hras-index.json");
  await page.goto(populatedTimeUrl);
  const snapshot = await (await snapshotResponse).json();
  await expect(page.locator("#results")).toBeVisible({ timeout: 20_000 });
  await page.locator("#locale-switcher").selectOption("ru");

  const header = page.locator(".app-header");
  expect((await header.boundingBox())?.height).toBeLessThan(290);
  await expect(page.locator('[data-provenance-entity="hras"] .provenance-version'))
    .toContainText(snapshot.treeVersion.replace(/^v/i, ""));
  await page.locator('.app-header [data-annotation="source-sync"]').click();
  const counts = page.locator("#context-annotation .provenance-sample-coverage dd");
  const formatCount = (value: number) => new Intl.NumberFormat("ru-RU").format(value);
  await expect(counts).toHaveText([formatCount(snapshot.sampleCount), formatCount(snapshot.hrasManifestSampleCount)]);
  await page.keyboard.press("Escape");

  await page.locator("#selection-panel-toggle").click();
  const picker = page.locator("#selection-panel");
  await picker.locator('[data-country-action="all"]').click();
  await picker.locator(".selected-more summary").click();
  const bounds = await picker.evaluate((dialog) => {
    const popover = dialog.querySelector<HTMLElement>(".selected-more .chip-popover")!;
    const popoverBox = popover.getBoundingClientRect();
    const dialogBox = dialog.getBoundingClientRect();
    return {
      popoverBottom: popoverBox.bottom,
      dialogBottom: dialogBox.bottom,
      clientHeight: popover.clientHeight,
      scrollHeight: popover.scrollHeight,
    };
  });
  expect(bounds.popoverBottom).toBeLessThanOrEqual(bounds.dialogBottom + 1);
  expect(bounds.scrollHeight).toBeGreaterThan(bounds.clientHeight);
  await page.screenshot({ path: `${evidenceDir}/fix-country-picker-390-ru.png`, fullPage: true });

  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1440, height: 900 });
  const headerGeometry = await header.evaluate((element) => {
    const brand = element.querySelector<HTMLElement>(".title-block")!.getBoundingClientRect();
    const utilities = element.querySelector<HTMLElement>(".header-utilities")!.getBoundingClientRect();
    return {
      brandCenter: brand.top + brand.height / 2,
      utilityCenter: utilities.top + utilities.height / 2,
    };
  });
  expect(Math.abs(headerGeometry.brandCenter - headerGeometry.utilityCenter)).toBeLessThanOrEqual(8);
  await page.screenshot({ path: `${evidenceDir}/fix-header-1440-ru.png`, fullPage: false });
});

test("audit fixes: date changes reuse a whole-timeline grid in all-branches mode", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const data = compact([-1,0,0], [20000,5500,5800], [[1,0,5],[2,1,6]]);
  data.countryCodes = ["RUS","POL","DEU"]; data.projectIds = ["R"];
  await page.route("**/data/hras-index.json", route => route.fulfill({json:data}));
  await page.goto("/?lang=en&countries=RUS,POL&presence=any&target=5500&window=300&min=0");
  await expect(page.locator("#export-csv")).toBeEnabled();
  const cells = page.locator("#target-density [data-density-index]");
  const initial = await cells.count(); expect(initial).toBeGreaterThan(1);
  await page.evaluate(() => { window.__auditDensityCell = document.querySelector("#target-density [data-density-index]"); });
  await page.locator("#target-year").fill("3501");
  await expect(page).toHaveURL(/target=5450/);
  await expect(page.locator("#live-status")).toHaveAttribute("data-busy", "false");
  expect(await page.evaluate(() => document.querySelector("#target-density [data-density-index]") === window.__auditDensityCell)).toBe(true);
  await expect(cells).toHaveCount(initial);
  await expect(page.locator(".density-result-range")).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  await expect(cells).toHaveCount(initial);
  const widths = await cells.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().width));
  expect(Math.min(...widths)).toBeGreaterThan(0);
  expect(Math.max(...widths)-Math.min(...widths)).toBeLessThan(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
