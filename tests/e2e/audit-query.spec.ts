import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

async function settled(page: Page) {
  await expect(page.locator("#live-status")).toHaveAttribute("data-busy", "false", { timeout: 20_000 });
}
async function start(page: Page) {
  await page.goto("/");
  await expect(page.locator("#result-body tr[data-result-role]").first()).toBeVisible({ timeout: 20_000 });
  await page.locator("#locale-switcher").selectOption("en");
}

test("audit: bounded date and blank numeric drafts cannot contradict ready results", async ({ page }) => {
  await start(page);
  const year = page.locator("#target-year");
  for (const [raw, expected, era] of [["-100", "1", "BCE"], ["1.5", "2", "BCE"], ["9999999", "998050", "BCE"], ["0", "1", "BCE"]]) {
    if (await page.locator("#target-era").getAttribute("value") !== "BCE") {
      await year.fill("100");
      await page.locator("#target-era").click();
    }
    await year.fill(raw);
    await year.press("Tab");
    await settled(page);
    await expect(year).toHaveValue(expected);
    await expect(page.locator("#target-era")).toHaveAttribute("value", era);
    expect(await year.evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(true);
    await expect(page.locator("#target-slider")).toHaveAttribute("aria-valuetext", new RegExp(era));
  }
  if (await page.locator("#target-era").getAttribute("value") !== "BCE") {
    await page.locator("#target-era").click();
  }
  await year.fill("3500");
  await settled(page);
  for (const [id, value] of [["target-year", "3500"], ["max-delta-ybp", "300"], ["min-result-samples", "5"]]) {
    const field = page.locator(`#${id}`);
    await field.fill("");
    await expect(page.locator("#export-csv")).toBeDisabled();
    await expect(page.locator("#result-body tr[data-result-role]")).toHaveCount(0);
    await field.press("Tab");
    await expect(field).toHaveValue(value);
    await settled(page);
    await expect(page.locator("#export-csv")).toBeEnabled();
  }
  await page.locator("#max-delta-ybp").fill("2");
  expect(await page.locator("#max-delta-ybp").evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(true);
});

test("audit: held drag cancels scheduled work and clears stale result highlights", async ({ page }) => {
  await start(page);
  await page.locator("#target-year").fill("4000"); // a request is already scheduled
  const slider = page.locator("#target-slider");
  const initialSliderValue = await slider.inputValue();
  const box = (await slider.boundingBox())!;
  await page.mouse.move(box.x + box.width * .6, box.y + box.height / 2);
  await page.mouse.down();
  try {
    await expect(slider).not.toHaveValue(initialSliderValue);
    await expect(page.locator("#target-year")).not.toHaveValue("4000");
    await expect(page.locator("#stat-target")).not.toHaveText(/4[\s,.]?000/);
    await page.waitForTimeout(800); // longer than the debounce; pointer intentionally held
    await expect(page.locator("#export-csv")).toBeDisabled();
    await expect(page.locator("#result-body tr[data-result-role]")).toHaveCount(0);
    await expect(page.locator(".density-cell.has-current-results")).toHaveCount(0);
    await expect(page.locator("#live-status")).toHaveAttribute("data-busy", "true");
  } finally { await page.mouse.up(); }
  await settled(page);
  const keyboardYear = await page.locator("#target-year").inputValue();
  await slider.focus();
  await slider.press("ArrowRight");
  await expect(page.locator("#target-year")).not.toHaveValue(keyboardYear);
  await settled(page);
  await page.locator("#target-year").fill("3500");
  await settled(page);
  await expect(page.locator("#export-csv")).toBeEnabled();
});

test("audit: era switch keeps separate BCE and CE drafts", async ({ page }) => {
  await start(page);
  const year = page.locator("#target-year");
  const era = page.locator("#target-era");
  await era.locator('[data-era="BCE"]').click();
  await year.fill("3500");
  await settled(page);
  await era.locator('[data-era="CE"]').click();
  await expect(era).toHaveAttribute("value", "CE");
  await expect(year).toHaveValue("1950");
  await settled(page);
  await era.locator('[data-era="BCE"]').click();
  await expect(era).toHaveAttribute("value", "BCE");
  await expect(year).toHaveValue("3500");
});

test("audit: density bucket click directly changes the target and slider", async ({ page }) => {
  test.setTimeout(60_000);
  await start(page);
  const year = page.locator("#target-year");
  const initial = await year.inputValue();
  const slider = page.locator("#target-slider"), initialSlider = await slider.inputValue();
  const bucket = page.locator("#target-density button.density-cell").first();
  await bucket.click();
  await expect(bucket).toHaveAttribute("aria-label", /Range:.*Duration:/);
  await expect(bucket).not.toHaveAttribute("title", /./);
  expect((await bucket.boundingBox())!.height).toBeGreaterThanOrEqual(32);
  await expect(year).not.toHaveValue(initial);
  await expect(slider).not.toHaveValue(initialSlider);
  await settled(page);
});

test("audit: CSV records the committed window and independent source provenance", async ({ page }) => {
  await start(page);
  const source = await page.request.get("/data/hras-index.json").then((r) => r.json());
  const downloadEvent = page.waitForEvent("download");
  await page.locator("#export-csv").click();
  const download = await downloadEvent;
  const csv = await readFile((await download.path())!, "utf8");
  const lines = csv.trimEnd().split(/\r?\n/);
  const cells = (line: string) => [...line.matchAll(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)]
    .map((m) => m[1].replace(/^"|"$/g, "").replaceAll('""', '"'));
  const headers = cells(lines[0]);
  for (const line of lines.slice(1)) {
    const row = Object.fromEntries(cells(line).map((v, i) => [headers[i], v]));
    expect(row.max_delta_ybp).toBe("300");
    expect(row.hras_snapshot_version).toBe(source.treeVersion);
    expect(row.yfull_reference_version).toBe(source.treeOfficialVersion);
    expect(row.hras_computed_date).toBe(source.computedDate);
    expect(row.index_generated_at).toBe(source.generatedAt);
    expect(row.calendar_base_year).toBe("1950");
    expect(row.calendar_basis_note).toContain("not verified");
  }
});
