import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { layoutFixture, layoutQuery } from "../fixtures/layout.mjs";

test.beforeEach(async ({ page }) => {
  await page.route("**/data/hras-index.json", route => route.fulfill({ json: layoutFixture() }));
});

test("contextual explanation is operable and CSV download opens as a complete result ledger", async ({ page }) => {
  await page.goto(layoutQuery);
  const rows = page.locator("#result-body tr[data-result-role]");
  await expect(rows.first()).toBeVisible({ timeout: 20_000 });

  const helpOpener = page.locator('.formed-result-set [data-annotation="formed"]');
  await helpOpener.click();
  const help = page.locator("#context-annotation");
  await expect(help).toBeVisible();
  await expect(help.locator("strong")).not.toHaveText("");
  await expect(help.locator('a[href*="nature.com"]')).toHaveCount(0);
  await expect(help).not.toContainText("Подробнее:");
  await page.keyboard.press("Escape");
  await expect(help).toBeHidden();
  await expect(helpOpener).toBeFocused();

  const expectedRows = await rows.count();
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export-csv").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^ynodus-.*\.csv$/);

  const path = await download.path();
  expect(path).not.toBeNull();
  const csv = await readFile(path!, "utf8");
  const lines = csv.trimEnd().split(/\r?\n/);
  expect(lines).toHaveLength(expectedRows + 1);
  expect(lines[0]).toContain("result_identity");
  expect(lines[0]).toContain("formed_branch_events");
  expect(lines[0]).toContain("total_selected");
  expect(lines.slice(1).every((line) => line.length > 0)).toBeTruthy();
});

test("macrogroup filter narrows committed rows and exports the same subset", async ({ page }) => {
  await page.goto(layoutQuery);
  await expect(page.locator("#result-body tr[data-result-role]").first()).toBeVisible({ timeout: 20_000 });
  const filter = page.locator("#result-macrogroup-filter");
  await expect(filter).toBeVisible();
  const macrogroup = await filter.locator("option").nth(1).getAttribute("value");
  expect(macrogroup).toBeTruthy();

  await filter.selectOption(macrogroup!);
  const rows = page.locator("#result-body tr[data-result-role]");
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeGreaterThan(0);
  expect(await rows.evaluateAll((items, group) => items.every((item) => item.getAttribute("data-macro-group") === group), macrogroup)).toBe(true);
  await expect(page.locator("#results")).not.toHaveAttribute("aria-busy", "true");
  await expect(page.locator("#result-count")).toContainText("/");

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export-csv").click();
  const download = await downloadPromise;
  const path = await download.path();
  const lines = (await readFile(path!, "utf8")).trimEnd().split(/\r?\n/);
  const header = lines[0]!.split(",");
  const filterIndex = header.indexOf("macrogroup_filter");
  const groupIndex = header.indexOf("macrogroup");
  expect(lines).toHaveLength((await rows.count()) + 1);
  for (const line of lines.slice(1)) {
    const values = line.split(",");
    expect(values[filterIndex]).toBe(macrogroup);
    expect(values[groupIndex]).toBe(macrogroup);
  }
});
