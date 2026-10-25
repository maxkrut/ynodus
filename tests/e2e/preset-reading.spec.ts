import { expect, test, type Page } from "@playwright/test";
import { compact } from "../../scripts/semantic-audit/fixtures.mjs";
import { revealPreset } from "./preset-support";

const viewports = [{ width: 390, height: 844 }, { width: 844, height: 390 }];
async function openCard(page: Page, locale: string) {
  const data = compact([-1], [5500], [[0, 0, 1], [0, 1, 1]]);
  data.countryCodes = ["RUS", "POL"];
  data.countryCounts = [1, 1];
  await page.route("**/data/hras-index.json", route => route.fulfill({ json: data }));
  await page.goto(`/?lang=${locale}&countries=RUS,POL&presence=any&target=5500&window=100&min=0`);
  await expect(page.locator('#result-body tr[data-result-role="formed"]')).toHaveCount(1);
  await page.locator("#selection-panel-toggle").click();
  const disclosure = page.locator("[data-toggle-presets]");
  if (await disclosure.isVisible()) await disclosure.click();
  await revealPreset(page, "arch-yamnaya");
  const trigger = page.locator('[data-preset-info="arch-yamnaya"]');
  const card = trigger.locator("..").locator(".preset-members-tooltip");
  return { trigger, card, url: page.url(), date: await page.locator("#target-year").inputValue() };
}

async function assertUnchanged(page: Page, url: string, date: string) {
  expect(page.url()).toBe(url);
  expect(await page.locator("#target-year").inputValue()).toBe(date);
  expect(await page.locator("#country-list input:checked").evaluateAll(inputs =>
    inputs.map(input => (input as HTMLInputElement).value).sort())).toEqual(["POL", "RUS"]);
}

test.describe("coarse-pointer preset cards", () => {
  test.use({ hasTouch: true });
  test("touch controls and sources remain usable in portrait and landscape", async ({ page, context, browserName }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    // Verify link activation without contacting an external website.
    await context.route("https://www.nature.com/**", route => route.fulfill({ body: "Synthetic source destination" }));
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      for (const locale of ["ru", "en",]) {
        const { trigger, card, url, date } = await openCard(page, locale);
        expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
        const triggerBox = await trigger.boundingBox();
        expect(triggerBox!.width).toBeGreaterThanOrEqual(44);
        expect(triggerBox!.height).toBeGreaterThanOrEqual(44);
        await trigger.tap();
        await expect(card).toBeVisible();
        const close = card.locator("[data-preset-card-close]");
        const closeBox = await close.boundingBox();
        expect(closeBox!.width).toBeGreaterThanOrEqual(44);
        expect(closeBox!.height).toBeGreaterThanOrEqual(44);
        const source = card.locator("a").first();
        await source.scrollIntoViewIfNeeded();
        const sourceBox = await source.boundingBox();
        expect(sourceBox!.height).toBeGreaterThanOrEqual(44);
        const destination = await source.getAttribute("href");
        const popupPromise = page.waitForEvent("popup");
        await source.tap();
        const popup = await popupPromise;
        await popup.waitForURL(destination!);
        await popup.close();
        await card.evaluate(el => { el.scrollTop = 0; });
        await expect.poll(() => card.evaluate(el => el.scrollTop)).toBe(0);
        if (process.env.YNODUS_QA_EVIDENCE_DIR) await card.screenshot({
          path: `${process.env.YNODUS_QA_EVIDENCE_DIR}/${browserName}/touch-${viewport.width}-${locale}.png`,
        });
        await close.tap();
        await expect(card).toBeHidden();
        await expect(trigger).toBeFocused();
        await expect(page.locator("#selection-panel")).toBeVisible();
        await assertUnchanged(page, url, date);
      }
    }
    expect(errors).toEqual([]);
  });

  test("touch period footnote exposes its calendar caveat and primary source", async ({ page, context, browserName }) => {
    await context.route("https://www.yfull.com/faq/definitions/", route => route.fulfill({ body: "Synthetic source destination" }));
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      for (const locale of ["ru", "en",]) {
        const { url, date } = await openCard(page, locale);
        await page.locator("#selection-panel > header > button").tap();
        await expect(page.locator("#selection-panel")).toBeHidden();
        const summary = page.locator('[data-annotation="periods"]');
        await summary.tap();
        const panel = page.locator("#context-annotation");
        await expect(panel).toBeVisible();
        const box = await panel.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
        expect(await panel.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
        await expect(panel.locator('[data-i18n="periodGuideEndpoint"]')).toContainText("YFull");
        const source = panel.locator('a[href="https://www.yfull.com/faq/definitions/"]');
        await source.scrollIntoViewIfNeeded();
        expect((await source.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        if (process.env.YNODUS_QA_EVIDENCE_DIR) await panel.screenshot({
          path: `${process.env.YNODUS_QA_EVIDENCE_DIR}/${browserName}/touch-period-source-${viewport.width}-${locale}.png`,
        });
        const popupPromise = page.waitForEvent("popup");
        await source.tap();
        const popup = await popupPromise;
        await popup.waitForURL("https://www.yfull.com/faq/definitions/");
        await popup.close();
        expect(page.url()).toBe(url);
        expect(await page.locator("#target-year").inputValue()).toBe(date);
      }
    }
  });
});

test("preset explanations reflow with doubled text without losing sources or close action", async ({ page, browserName }) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const locale of ["ru", "en",]) {
      const { trigger, card, url, date } = await openCard(page, locale);
      // Text-only stress simulation: double computed fonts, retain layout widths/padding.
      // This does not emulate a browser's native zoom preference or a physical device.
      await page.locator("#selection-panel").evaluate(dialog => {
        const fonts = [dialog, ...dialog.querySelectorAll<HTMLElement>("*")]
          .map(el => [el, parseFloat(getComputedStyle(el).fontSize)] as const);
        for (const [el, size] of fonts) (el as HTMLElement).style.fontSize = `${size * 2}px`;
      });
      await trigger.focus();
      await trigger.press("Enter");
      await expect(card).toBeVisible();
      expect(await card.locator(".preset-info-body p").first().evaluate(el =>
        parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(22);
      const geometry = await card.evaluate(el => {
        const box = el.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom,
          overflow: el.scrollWidth - el.clientWidth };
      });
      expect(geometry.left).toBeGreaterThanOrEqual(0);
      expect(geometry.right).toBeLessThanOrEqual(viewport.width);
      expect(geometry.top).toBeGreaterThanOrEqual(0);
      expect(geometry.bottom).toBeLessThanOrEqual(viewport.height);
      expect(geometry.overflow).toBeLessThanOrEqual(1);
      const source = card.locator("a").first();
      await source.focus();
      await expect.poll(() => source.evaluate(el => {
        const box = el.getBoundingClientRect();
        const surface = el.closest(".preset-members-tooltip")!.getBoundingClientRect();
        return Math.max(surface.top - box.top, box.bottom - surface.bottom);
      })).toBeLessThanOrEqual(0);
      await card.evaluate(el => { el.scrollTop = 0; });
      await expect.poll(() => card.evaluate(el => el.scrollTop)).toBe(0);
      if (process.env.YNODUS_QA_EVIDENCE_DIR) await card.screenshot({
        path: `${process.env.YNODUS_QA_EVIDENCE_DIR}/${browserName}/text-200-${viewport.width}-${locale}.png`,
      });
      await card.locator("[data-preset-card-close]").click();
      await expect(card).toBeHidden();
      await expect(trigger).toBeFocused();
      await assertUnchanged(page, url, date);
    }
  }
});
