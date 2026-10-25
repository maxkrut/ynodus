import { expect, test } from "@playwright/test";
import { branchCountriesFixture } from "../fixtures/branch-countries.mjs";
import fs from "node:fs/promises";

test("country picker closed during startup retains focus after data arrives", async ({ page }) => {
  let releaseData!: () => void;
  const dataReady = new Promise<void>(resolve => { releaseData = resolve; });
  await page.route("**/data/hras-index.json", async route => {
    await dataReady;
    await route.fulfill({ json: branchCountriesFixture() });
  });
  await page.goto("/?countries=RUS");
  const opener = page.locator("#selection-panel-toggle");
  await opener.click();
  await expect(page.locator("#selection-panel")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  releaseData();
  await expect(page.locator("#export-csv")).toBeEnabled();
  await expect(opener).toBeFocused();
});

for (const width of [390, 1440]) for (const locale of ["en", "ru"]) {
  test(`fresh startup waits for chosen countries at ${width}px in ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.route("**/data/hras-index.json", route => route.fulfill({ json: branchCountriesFixture() }));
    await page.goto(`/?lang=${locale}`);
    const empty = locale === "ru" ? "Выберите хотя бы одну страну." : "Select at least one country.";
    await expect(page.locator(".empty-title")).toHaveText(empty);
    await expect(page.locator("#stat-selected")).toHaveText("0");
    await expect(page.locator("#export-csv")).toBeDisabled();
    await expect(page.locator("#result-body tr[data-result-role]")).toHaveCount(0);
    expect(new URL(page.url()).searchParams.get("countries")).toBe("");
    expect(new URL(page.url()).searchParams.has("preset")).toBe(false);
    await expect(page.locator("#workspace-link-note")).toBeHidden();
    await fs.mkdir("output/startup", { recursive: true });
    await page.screenshot({ path: `output/startup/${width}-${locale}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);

    await page.locator("#selection-panel-toggle").click();
    await expect(page.locator("#country-list input:checked")).toHaveCount(0);
    await expect(page.locator('[data-country-preset-option][aria-pressed="true"]')).toHaveCount(0);
    await page.locator('[data-country-code="RUS"]').check();
    await page.keyboard.press("Escape");
    const row = page.locator('#result-body tr[data-result-role]').first();
    await expect(row.locator(".table-branch-identity")).toHaveText("R-SYN-ROOT");
    await expect(row.locator(".table-total strong")).toHaveText("7");
    await expect(page.locator("#export-csv")).toBeEnabled();
    expect(new URL(page.url()).searchParams.get("countries")).toBe("RUS");
    await page.reload();
    await expect(row.locator(".table-total strong")).toHaveText("7");
    await expect(page.locator("#stat-selected")).toHaveText("1");

    await page.goto(`/?lang=${locale}`);
    await expect(page.locator(".empty-title")).toHaveText(empty);
    await expect(page.locator("#stat-selected")).toHaveText("0");
    await expect(page.locator("#export-csv")).toBeDisabled();
  });
}
