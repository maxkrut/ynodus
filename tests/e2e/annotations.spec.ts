import { expect, test, type Page } from "@playwright/test";
import { layoutFixture, layoutQuery } from "../fixtures/layout.mjs";

async function ready(page: Page) {
  await page.route("**/data/hras-index.json", route => route.fulfill({ json: layoutFixture() }));
  await page.goto(layoutQuery);
  await expect(page.locator('#result-body tr[data-result-role="formed"]')).toHaveCount(15);
}

test("annotations support hover, pinned clicks and keyboard sources without changing the query", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await ready(page);
  const panel = page.locator("#context-annotation");
  const windowNote = page.locator('[data-annotation="window"]');
  await windowNote.hover();
  await expect(panel).toContainText("не доверительный интервал");
  await panel.hover();
  await expect(panel).toBeVisible();
  await page.locator(".brand-head").hover();
  await expect(panel).toBeHidden();
  await windowNote.click();
  await page.locator(".brand-head").hover();
  await expect(panel).toBeVisible();
  await windowNote.click();
  await expect(panel).toBeHidden();
  await expect(windowNote).toHaveAttribute("aria-expanded", "false");

  const date = page.locator('[data-annotation="date"]');
  await date.focus();
  await expect(panel).toContainText("а не 1950 года");
  await page.keyboard.press("Tab");
  await expect(panel.locator("summary")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(panel.locator("details")).toHaveAttribute("open", "");
  await page.keyboard.press("Tab");
  await expect(panel.locator("a")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(panel.locator("summary")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(date).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(date).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#target-year")).toBeFocused();
  await date.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(page.locator("#target-year")).toBeFocused();
  await expect(panel).toHaveAttribute("role", "tooltip");
  await expect(panel).toContainText("Дата для сравнения");

  const originalUrl = page.url();
  const originalDate = await page.locator("#target-year").inputValue();
  await page.locator('#query-crossing-control [data-annotation="crossing"]').click();
  await expect(panel).toContainText("Допуск ± здесь не используется");
  await expect(page.locator("#include-crossing")).not.toBeChecked();
  await expect(page.locator("#target-year")).toHaveValue(originalDate);
  await expect(page.locator('#result-body tr[data-result-role="formed"]')).toHaveCount(15);
  expect(page.url()).toBe(originalUrl);
  await page.locator(".brand-head").click();
  await expect(panel).toBeHidden();

  await page.locator('[data-open-result-detail="R-SYN-100"]').click();
  await page.goBack();
  await page.locator('[data-annotation="formed"]').click();
  await expect(panel).toBeVisible();
  await page.goForward();
  await expect(page.locator("#profile-workspace")).toBeVisible();
  await expect(panel).toBeHidden();
});

for (const [width, height] of [[320, 900], [390, 844], [1050, 900], [1440, 900], [844, 390]]) {
  test(`every subject stays localized and its note fits ${width}×${height}`, async ({ page }) => {
    await ready(page);
    const subjects = ["countries", "date", "window", "minimum", "presence", "formed", "crossing", "density"];
    await page.setViewportSize({ width, height });
    for (const locale of ["ru", "en",]) {
      await page.locator("#locale-switcher").selectOption(locale);
      for (const subject of subjects) {
        const badge = page.locator(`[data-annotation="${subject}"]`).first();
        await badge.scrollIntoViewIfNeeded();
        await badge.click();
        const panel = page.locator("#context-annotation");
        await expect(panel).toBeVisible();
        await expect(panel.locator("strong")).not.toHaveText("");
        await expect(badge).toHaveAttribute("aria-label", /\S+/);
        const bounds = await panel.evaluate(el => {
          const r = el.getBoundingClientRect();
          return { left: r.left, top: r.top, right: r.right, bottom: r.bottom,
            overflow: el.scrollWidth - el.clientWidth, vw: innerWidth, vh: innerHeight };
        });
        const label = `${subject}, ${locale}, ${width}×${height}`;
        expect(bounds.left, label).toBeGreaterThanOrEqual(7);
        expect(bounds.top, label).toBeGreaterThanOrEqual(7);
        expect(bounds.right, label).toBeLessThanOrEqual(bounds.vw - 7);
        expect(bounds.bottom, label).toBeLessThanOrEqual(bounds.vh - 7);
        expect(bounds.overflow, label).toBeLessThanOrEqual(1);
        await page.keyboard.press("Escape");
        await expect(panel).toBeHidden();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    }
  });
}

test("annotation glyphs stay vertically centred beside visible label text", async ({ page }) => {
  await ready(page);
  for (const width of [320, 390, 1050, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const locale of ["ru", "en",]) {
      await page.locator("#locale-switcher").selectOption(locale);
      const offsets = await page.locator(".annotation-trigger:visible").evaluateAll(buttons => buttons.map(button => {
        const text = document.createRange();
        // Source-version badges follow a text node rather than a label element.
        let preceding = button.previousSibling;
        let label: DOMRect | undefined;
        while (preceding) {
          text.selectNodeContents(preceding);
          const box = text.getBoundingClientRect();
          if (preceding.textContent?.trim() && box.width && box.height) { label = box; break; }
          preceding = preceding.previousSibling;
        }
        if (!label) throw new Error(`No visible label for ${(button as HTMLElement).dataset.annotation}`);
        const glyph = button.querySelector("span")!.getBoundingClientRect();
        return { subject: (button as HTMLElement).dataset.annotation,
          offset: Math.abs(label.top + label.height / 2 - glyph.top - glyph.height / 2) };
      }));
      expect(offsets.length).toBeGreaterThanOrEqual(8);
      for (const { subject, offset } of offsets) expect(offset, `${subject}: ${width}px ${locale}`).toBeLessThanOrEqual(1);
    }
  }
});

test("source links and licences are visible beside source facts without collisions", async ({ page }) => {
  await ready(page);
  await expect(page.locator("#mockup-help")).toHaveCount(0);
  for (const width of [320, 390, 761, 1050, 1051, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const locale of ["ru", "en",]) {
      await page.locator("#locale-switcher").selectOption(locale);
      await expect(page.locator('.provenance-links a[href$="LICENSE"]')).toBeVisible();
      await expect(page.locator('.provenance-links a[href$="LICENSE.md"]')).toBeVisible();
      await expect(page.locator('.provenance-links a[href$="LICENSE.txt"]')).toBeVisible();
      const defects = await page.locator(".provenance-row").evaluateAll(rows => rows.flatMap(row => {
        const nav = row.querySelector(".provenance-links")!;
        const date = row.querySelector(".provenance-date")!.getBoundingClientRect();
        const box = nav.getBoundingClientRect();
        const errors: string[] = [];
        if (innerWidth > 1050 ? box.left < date.right : box.top < date.bottom) errors.push("links overlap date");
        const children = [...nav.children].map(el => {
          const range = document.createRange(); range.selectNodeContents(el);
          return range.getBoundingClientRect();
        });
        children.forEach((r, i) => {
          if (r.left < 0 || r.right > innerWidth) errors.push("link outside viewport");
          if (children.slice(0, i).some(previous => previous.left < r.right - 1 && previous.right > r.left + 1 && previous.top < r.bottom - 1 && previous.bottom > r.top + 1)) errors.push("link text overlaps");
        });
        return errors;
      }));
      expect(defects, `${width}px ${locale}`).toEqual([]);
    }
  }
});

test.describe("touch annotations", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test("first tap opens, second tap closes, and changing language dismisses the note", async ({ page }) => {
    await ready(page);
    const badge = page.locator('[data-annotation="date"]');
    const panel = page.locator("#context-annotation");
    await badge.tap();
    await expect(panel).toBeVisible();
    await badge.tap();
    await expect(panel).toBeHidden();
    await badge.tap();
    await expect(panel).toBeVisible();
    await page.locator("#locale-switcher").selectOption("en");
    await expect(panel).toBeHidden();
    await expect(badge).toHaveAttribute("aria-label", "About the date and calendar");
    await badge.tap();
    await expect(panel).toContainText("not 1950");
    await page.locator("#selection-panel-toggle").tap();
    await expect(page.locator("#selection-panel")).toBeVisible();
    await expect(panel).toBeHidden();
  });
});
