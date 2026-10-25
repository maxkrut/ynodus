import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import type { CountryPreset } from "../../src/shared/types";
import { compact } from "../../scripts/semantic-audit/fixtures.mjs";
import { revealPreset } from "./preset-support";

const presets: CountryPreset[] = fs.readdirSync("src/presets").filter(file => file.endsWith(".json"))
  .map(file => JSON.parse(fs.readFileSync(`src/presets/${file}`, "utf8")));
const codes = [...new Set(presets.flatMap(preset => preset.countries))].sort();
async function openPicker(page: Page, available = codes, locale = "ru") {
  const data = compact([-1], [5500], available.map((_, i) => [0, i, 1]));
  data.countryCodes = available;
  data.countryCounts = available.map(() => 1);
  await page.route("**/data/hras-index.json", route => route.fulfill({ json: data }));
  await page.goto(`/?lang=${locale}&countries=RUS,POL&presence=any&target=5500&window=100&min=0`);
  await expect(page.locator('#result-body tr[data-result-role="formed"]')).toHaveCount(1);
  await page.locator("#selection-panel-toggle").click();
  const disclosure = page.locator("[data-toggle-presets]");
  if (await disclosure.isVisible()) await disclosure.click();
}
const selection = (page: Page) => page.locator("#country-list input:checked").evaluateAll(
  inputs => inputs.map(input => (input as HTMLInputElement).value).sort());

function card(page: Page, key: string) {
  return page.locator(`[data-preset-info="${key}"]`).locator("..").locator(".preset-members-tooltip");
}

test("all 33 preset details combine member countries and guide without applying the preset", async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await openPicker(page);
  const initial = await selection(page);
  const date = await page.locator("#target-year").inputValue();
  const url = page.url();
  expect(presets).toHaveLength(33);
  await expect(page.locator("[data-preset-info]")).toHaveCount(33);
  await expect(page.locator("#preset-info-dialog")).toHaveCount(0);
  for (const preset of presets) {
    await revealPreset(page, preset.key);
    expect(preset.guide, preset.key).toBeTruthy();
    const trigger = page.locator(`[data-preset-info="${preset.key}"]`);
    const details = card(page, preset.key);
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    await expect(details).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(trigger).toBeFocused();
    await expect(details).toContainText(preset.guide!.region.ru);
    await expect(details).toContainText(preset.guide!.selection.ru);
    expect(await details.locator(".preset-member code").allTextContents()).toEqual(preset.countries);
    expect(await details.locator("a").evaluateAll(links => links.map(link => (link as HTMLAnchorElement).href)))
      .toEqual(preset.guide!.sources.map(source => new URL(source.url).href));
    expect(await selection(page)).toEqual(initial);
    expect(await page.locator("#target-year").inputValue()).toBe(date);
    expect(page.url()).toBe(url);
    await page.keyboard.press("Escape");
    await expect(details).toBeHidden();
    await expect(trigger).toBeFocused();
  }
  expect(errors).toEqual([]);
});

test("preset cards open only on request and fit picker at mobile and desktop widths", async ({ page }) => {
  await openPicker(page);
  for (const width of [340, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const disclosure = page.locator("[data-toggle-presets]");
    if (await disclosure.isVisible() && await disclosure.getAttribute("aria-expanded") === "false") await disclosure.click();
    await revealPreset(page, "arch-indus-valley");
    const option = page.locator('[data-country-preset-option="arch-indus-valley"]');
    const trigger = page.locator('[data-preset-info="arch-indus-valley"]');
    const details = card(page, "arch-indus-valley");
    await option.hover();
    await expect(details).toBeHidden();
    await trigger.click();
    await expect(details).toBeVisible();
    const geometry = await details.evaluate(el => {
      const rect = el.getBoundingClientRect();
      const picker = el.closest("dialog")!.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
        pickerLeft: picker.left, pickerRight: picker.right, pickerTop: picker.top, pickerBottom: picker.bottom,
        overflow: el.scrollWidth - el.clientWidth, pageOverflow: document.documentElement.scrollWidth - innerWidth };
    });
    expect(geometry.left).toBeGreaterThanOrEqual(geometry.pickerLeft);
    expect(geometry.right).toBeLessThanOrEqual(geometry.pickerRight);
    expect(geometry.top).toBeGreaterThanOrEqual(geometry.pickerTop);
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.pickerBottom);
    expect(Math.max(geometry.overflow, geometry.pageOverflow)).toBeLessThanOrEqual(1);
    await page.keyboard.press("Escape");
    await expect(details).toBeHidden();
  }
});

test("preset details distinguish configured countries from those available in the data", async ({ page }) => {
  await openPicker(page, ["RUS", "POL", "IND", "PAK"]);
  await revealPreset(page, "arch-indus-valley");
  await page.locator('[data-preset-info="arch-indus-valley"]').click();
  const details = card(page, "arch-indus-valley");
  await expect(details).toContainText("Нет в текущих данных - при выборе пропускаются: AFG");
  expect(await details.locator(".preset-member code").allTextContents()).toEqual(["PAK", "IND", "AFG"]);
  await page.keyboard.press("Escape");
  await page.locator('[data-country-preset-option="arch-indus-valley"]').click();
  expect(await selection(page)).toEqual(["IND", "PAK"]);
});

test("localized preset cards retain keyboard focus and reachable sources in portrait and landscape", async ({ page, browserName }) => {
  // Nine independent page loads and captures share this scenario's deadline.
  test.setTimeout(60000);
  const preset = presets.find(item => item.key === "arch-yamnaya")!;
  for (const locale of ["ru", "en",] as const) {
    for (const viewport of [{ width: 390, height: 900 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      await openPicker(page, codes, locale);
      await revealPreset(page, "arch-yamnaya");
      const initial = await selection(page);
      const trigger = page.locator('[data-preset-info="arch-yamnaya"]');
      const details = card(page, "arch-yamnaya");
      await trigger.focus();
      await page.keyboard.press("Enter");
      await expect(details).toBeVisible();
      await expect(details).toContainText(preset.guide!.region[locale]);
      await expect(details).toContainText(preset.guide!.selection[locale]);
      await page.keyboard.press("Tab");
      // Firefox includes a scrollable region in native sequential navigation.
      if (await details.evaluate(el => document.activeElement === el)) await page.keyboard.press("Tab");
      await expect(details.locator("[data-preset-card-close]")).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(details.locator("a").first()).toBeFocused();
      await expect(details).toBeVisible();
      const link = details.locator("a").first();
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
      await expect.poll(() => link.evaluate(el => {
        const box = el.getBoundingClientRect();
        const card = el.closest(".preset-members-tooltip")!.getBoundingClientRect();
        return Math.max(card.top - box.top, box.bottom - card.bottom);
      })).toBeLessThanOrEqual(0);
      const geometry = await details.evaluate(el => {
        const box = el.getBoundingClientRect();
        const active = document.activeElement!.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom,
          focusedTop: active.top, focusedBottom: active.bottom, overflow: el.scrollWidth - el.clientWidth };
      });
      expect(geometry.left).toBeGreaterThanOrEqual(0);
      expect(geometry.right).toBeLessThanOrEqual(viewport.width);
      expect(geometry.top).toBeGreaterThanOrEqual(0);
      expect(geometry.bottom).toBeLessThanOrEqual(viewport.height);
      expect(geometry.focusedTop).toBeGreaterThanOrEqual(geometry.top);
      expect(geometry.focusedBottom).toBeLessThanOrEqual(geometry.bottom);
      expect(geometry.overflow).toBeLessThanOrEqual(1);
      expect(await selection(page)).toEqual(initial);
      // After reaching a source, the reader can scroll back to the description.
      await details.evaluate(el => { el.scrollTop = 0; });
      await expect.poll(() => details.evaluate(el => el.scrollTop)).toBe(0);
      if (process.env.YNODUS_QA_EVIDENCE_DIR) {
        await details.screenshot({ path: `${process.env.YNODUS_QA_EVIDENCE_DIR}/${browserName}/preset-${viewport.width}-${locale}.png` });
      }
      await page.keyboard.press("Escape");
      await expect(details).toBeHidden();
      await expect(trigger).toBeFocused();
      await expect(page.locator("#selection-panel")).toBeVisible();
      // Reopening can replace the active card; its close action restores focus.
      await trigger.press("Space");
      await details.locator("[data-preset-card-close]").click();
      await expect(trigger).toBeFocused();
    }
  }
});
