import { populatedTimeUrl } from "../fixtures/time-url";
import { expect, test, type Page } from "@playwright/test";
import { revealPreset } from "./preset-support";

async function ready(page: Page) {
  await page.goto(populatedTimeUrl);
  await expect(page.locator("#result-body tr[data-result-role]").first()).toBeVisible({ timeout: 20_000 });
}

test("BR-202: history dismisses transient dialogs and focuses the destination", async ({ page }) => {
  await ready(page);
  await page.locator('[data-research-view="profile"]').click();
  await page.locator('#profile-clade-search').fill('R-Z645');
  await page.locator('#profile-lookup button[type="submit"]').click();
  await expect(page.locator("#profile-content h3").first()).toHaveText("R-Z645");
  for (const trigger of ["#selection-panel-toggle"]) {
    await page.locator('.research-entrypoints [data-research-view="time"]').click();
    await page.locator(trigger).first().click();
    await expect(page.locator("dialog[open]")).toHaveCount(1);
    await page.goBack();
    await expect(page.locator("#profile-workspace")).toBeVisible();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await expect(page.locator("#profile-workspace-title")).toBeFocused();
    await page.goForward();
    await expect(page.locator("#time-workspace")).toBeVisible();
    await expect(page.locator("#query-zone-title")).toBeFocused();
    await page.goBack();
    await expect(page.locator("#profile-workspace-title")).toBeFocused();
  }
});

test("BR-203: the first touch applies a preset without a hover interceptor", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  try {
    const page = await context.newPage();
    await ready(page);
    for (const locale of ["ru", "en",]) {
      await page.locator("#locale-switcher").selectOption(locale);
      await page.locator("#selection-panel-toggle").tap();
      const disclosure = page.locator("[data-toggle-presets]");
      if (await disclosure.getAttribute("aria-expanded") === "false") await disclosure.tap();
      for (const [key, count] of [["baltic", 2], ["slavic", 13]] as const) {
        await revealPreset(page, key);
        const preset = page.locator(`[data-country-preset-option="${key}"]`);
        await preset.scrollIntoViewIfNeeded();
        await preset.tap();
        await expect(preset).toHaveAttribute("aria-pressed", "true");
        await expect(page.locator("#country-list input:checked")).toHaveCount(count);
        await expect(page.locator(".preset-members-tooltip:visible")).toHaveCount(0);
      }
      await page.locator("#selection-panel-close").tap();
    }
  } finally { await context.close(); }
});

test("BR-205: checkbox edits update both counters without replacing the focused input", async ({ page }) => {
  await ready(page);
  for (const locale of ["ru", "en",]) {
    await page.locator("#locale-switcher").selectOption(locale);
    await page.locator("#selection-panel-toggle").click();
    await revealPreset(page, "slavic");
    await page.locator('[data-country-preset-option="slavic"]').click();
    const input = page.locator('input[data-country-code="AUT"]');
    await input.focus();
    for (const count of [14, 13]) {
      await page.keyboard.press("Space");
      await expect(page.locator("#country-list input:checked")).toHaveCount(count);
      await expect(page.locator(".country-list-status > span").first()).toContainText(String(count));
      await expect(page.locator("#picker-selected-count")).toContainText(String(count));
      await expect(input).toBeFocused();
    }
    await page.locator('[data-country-action="none"]').click();
    await expect(page.locator(".country-list-status > span").first()).toContainText("0");
    await page.locator('[data-country-action="all"]').click();
    const count = await page.locator("#country-list input:checked").count();
    await expect(page.locator(".country-list-status > span").first()).toContainText(String(count));
    await expect(page.locator("#picker-selected-count")).toContainText(String(count));
    await page.keyboard.press("Escape");
    await expect(page.locator("#selection-panel-toggle")).toBeFocused();
  }
});

test("BR-208: preset details require explicit activation and close on Escape", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await ready(page);
  await page.locator("#selection-panel-toggle").click();
  await revealPreset(page, "arabic");
  const preset = page.locator('[data-country-preset-option="arabic"]');
  const tip = preset.locator("..").locator(".preset-members-tooltip");
  await preset.hover();
  await expect(tip).toBeHidden();
  const info = preset.locator("..").locator("[data-preset-info]");
  await info.focus();
  await page.keyboard.press("Enter");
  await expect(tip).toBeVisible();
  const box = (await tip.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.wheel(0, 250);
  await expect.poll(() => tip.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await expect(tip).toBeHidden();
  await expect(info).toBeFocused();
  await preset.click();
  await expect(preset).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(page.locator("#selection-panel-toggle")).toBeFocused();
});
