import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import { compact } from "../../scripts/semantic-audit/fixtures.mjs";
import { revealPreset } from "./preset-support";

async function start(page: Page) {
  const presets = await Promise.all((await fs.readdir("src/presets"))
    .filter(name => name.endsWith(".json"))
    .map(async name => JSON.parse(await fs.readFile(`src/presets/${name}`, "utf8"))));
  const codes: string[] = [...new Set<string>(presets.flatMap(preset => preset.countries))];
  const fixture = compact([-1], [6600], codes.map((_, i) => [0, i, 10 + i]));
  fixture.countryCodes = codes;
  fixture.countryCounts = codes.map((_, i) => 10 + i);
  fixture.hrasManifestSampleCount = fixture.countryCounts.reduce((sum, n) => sum + n, 0);
  fixture.nodeIds = ["R-SYN-PICKER"];
  fixture.projectIds = ["R"];
  await page.route("**/data/hras-index.json", route => route.fulfill({ json: fixture }));
  await page.goto("/?lang=ru&countries=RUS,POL&presence=any&target=6600&window=300&min=5");
  await expect(page.locator('#result-body tr[data-result-role="formed"]')).toHaveCount(1);
  await page.locator("#selection-panel-toggle").click();
}

test("wide presets on the right preserve group disclosure, selection and locale", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await start(page);
  const groups = page.locator("[data-preset-group]");
  await expect(groups).toHaveCount(3);
  await expect(page.locator("[data-country-preset-option]")).toHaveCount(33);
  expect(await groups.locator(":scope > summary small").allTextContents()).toEqual(["10", "7", "16"]);
  const before = page.url();
  const language = page.locator('[data-preset-group="presetGroupLanguage"]');
  await language.locator(":scope > summary").focus();
  await page.keyboard.press("Enter");
  await expect(language).toHaveAttribute("open", "");
  expect(page.url()).toBe(before);
  await page.locator('[data-country-preset-option="slavic"]').click();
  await expect(page.locator("#country-list input:checked")).toHaveCount(13);
  const preview = page.locator('#selected-summary .selected-chips > .selected-chip');
  await expect.poll(() => preview.count()).toBeGreaterThan(3);
  const wideCount = await preview.count();
  const selected = page.locator('#selected-summary');
  const unusedWidth = await selected.evaluate(host => {
    const chips = host.querySelector<HTMLElement>('.selected-chips')!;
    const children = [...chips.children].filter(child => child.getBoundingClientRect().width > 0);
    return chips.getBoundingClientRect().right - children.at(-1)!.getBoundingClientRect().right;
  });
  expect(unusedWidth).toBeLessThan(115);
  await page.setViewportSize({ width: 390, height: 960 });
  await expect.poll(() => preview.count()).toBeLessThan(wideCount);
  await expect(selected.locator('.selected-chip')).toHaveCount(13);
  await page.setViewportSize({ width: 1440, height: 960 });
  await expect.poll(() => preview.count()).toBe(wideCount);
  await expect(page.locator(".preset-browser-heading strong")).toContainText("Славянские языки");
  await language.locator(":scope > summary").click();
  await page.locator("#country-search").fill("Россия");
  await expect(language).not.toHaveAttribute("open");
  await page.locator("#country-search").fill("");
  const url = page.url();
  for (const locale of ["en", "ru"]) {
    await page.locator("#selection-panel-close").click();
    await page.locator("#locale-switcher").selectOption(locale);
    await page.locator("#selection-panel-toggle").click();
    await expect(language).not.toHaveAttribute("open");
    await expect(page.locator("#country-list input:checked")).toHaveCount(13);
  }
  expect(new URL(page.url()).searchParams.get("countries")).toBe(new URL(url).searchParams.get("countries"));
  await revealPreset(page, "slavic");
  await page.locator('.preset-browser-body').evaluate(el => { el.scrollTop = 0; });
  const geometry = await page.evaluate(() => {
    const panel = document.querySelector("#country-presets")!.getBoundingClientRect();
    const list = document.querySelector("#country-list")!.getBoundingClientRect();
    return { panelLeft: panel.left, listRight: list.right, panelWidth: panel.width, listWidth: list.width,
      scale: parseFloat(getComputedStyle(document.documentElement).zoom) || 1 };
  });
  expect(geometry.panelLeft).toBeGreaterThanOrEqual(geometry.listRight - 1);
  expect(geometry.panelWidth / geometry.scale).toBeGreaterThanOrEqual(390);
  expect(geometry.listWidth / geometry.scale).toBeGreaterThan(780);
  await fs.mkdir("output/country-picker", { recursive: true });
  await page.screenshot({ path: "output/country-picker/desktop-ru.png" });
  await page.locator('[data-country-code="RUS"]').uncheck();
  await expect(page.locator('[data-country-preset-option][aria-pressed="true"]')).toHaveCount(0);
  await expect(language).toHaveAttribute("open", "");
});

test("country picker keeps groups, cards and footer reachable across narrow layouts", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const viewport of [
    { width: 390, height: 844 }, { width: 760, height: 900 },
    { width: 761, height: 900 }, { width: 844, height: 390 },
    { width: 1050, height: 900 }, { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await start(page);
    await revealPreset(page, "slavic");
    await page.locator('[data-country-preset-option="slavic"]').click();
    await expect(page.locator("#country-list input:checked")).toHaveCount(13);
    await revealPreset(page, "arch-yamnaya");
    const info = page.locator('[data-preset-info="arch-yamnaya"]');
    await info.click();
    const card = page.locator(".preset-option-wrap.card-open .preset-members-tooltip");
    await expect(card).toBeVisible();
    const box = (await card.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
    await page.keyboard.press("Escape");
    await expect(page.locator("#selection-panel")).toBeVisible();
    const footer = (await page.locator("#selection-panel-done").boundingBox())!;
    expect(footer.y).toBeGreaterThanOrEqual(0);
    expect(footer.y + footer.height).toBeLessThanOrEqual(viewport.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (viewport.width === 390) {
      const checked = page.locator('#country-list input:checked');
      for (let i = 0; i < 4; i++) await checked.last().uncheck();
      await expect(page.locator('#selected-summary .selected-chip')).toHaveCount(9);
      await expect.poll(() => page.locator('#selected-summary .selected-chips > .selected-chip').count()).toBeLessThan(9);
      expect(await page.locator('#selected-summary').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await fs.mkdir("output/country-picker", { recursive: true });
      await page.screenshot({ path: "output/country-picker/mobile-ru.png" });
    }
    await page.locator("#selection-panel-done").click();
    await expect(page.locator("#selection-panel")).toBeHidden();
  }
  expect(errors).toEqual([]);
});
