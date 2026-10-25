import { populatedTimeUrl } from "../fixtures/time-url";
import { expect, test } from "@playwright/test";

test("critical breakpoints keep neighboring controls and research views geometrically stable", async ({ page }) => {
  test.setTimeout(180_000);
  for (const width of [320, 340, 390, 430, 431, 640, 760, 761, 980, 981, 1279, 1280, 1366, 1440, 1441]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(populatedTimeUrl);
    await expect(page.locator("#result-body tr[data-result-role]").first()).toBeVisible({ timeout: 20_000 });
    for (const locale of ["ru", "en",]) {
      await page.locator("#locale-switcher").selectOption(locale);
      const geometry = await page.evaluate(() => {
        const visible = (el: Element): el is HTMLElement => el instanceof HTMLElement
          && el.getBoundingClientRect().width > 1 && el.getBoundingClientRect().height > 1
          && !el.classList.contains("visually-hidden");
        const rect = (selector: string) => document.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
        const overlaps = (elements: Element[]) => elements.filter(visible).flatMap((el, index, all) =>
          all.slice(index + 1).flatMap(other => {
            const a = el.getBoundingClientRect(), b = other.getBoundingClientRect();
            const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            return x > 1 && y > 1 ? [el.className + " / " + other.className] : [];
          }));
        const fits = (parent: HTMLElement) => {
          const outer = parent.getBoundingClientRect();
          return [...parent.children].filter(visible).every(child => {
            const box = child.getBoundingClientRect();
            return box.left >= outer.left - 1 && box.right <= outer.right + 1
              && box.top >= outer.top - 1 && box.bottom <= outer.bottom + 1;
          });
        };
        const sourceRows = [...document.querySelectorAll<HTMLElement>(".provenance-row")];
        const groups = [...document.querySelectorAll<HTMLElement>(
          ".query-parameters, .query-scope-row, #selection-panel-toggle, .header-utilities, .mockup-target-date-control, .delta-stepper",
        )];
        const target = rect("#target-year"), era = rect("#target-era");
        const log = rect(".time-axis-scale-note"), paleo = rect('[data-period-band="paleolithic"]');
        const meso = rect('[data-period-band="mesolithic"]');
        const brand = rect(".brand-logo-text"), tagline = rect(".title-block h1");
        return {
          scroll: document.documentElement.scrollWidth, viewport: innerWidth,
          collisions: [...groups, ...sourceRows].flatMap(group => overlaps([...group.children])),
          clipped: [...groups, ...sourceRows].filter(el => !fits(el)).map(el => el.className),
          targetWidth: target.width,
          targetEdges: Math.max(Math.abs(target.top - era.top), Math.abs(target.bottom - era.bottom)),
          periodOverlap: overlaps([...document.querySelectorAll(".time-axis-periods > span")]),
          logDrift: Math.max(Math.abs(log.right - paleo.right), Math.abs(log.right - meso.left)),
          taglineDrift: tagline.width > 0 ? Math.abs(brand.left - tagline.left) : 0,
          sourceAxes: [".provenance-entity", ".provenance-version", ".provenance-date"].map(selector => {
            const xs = sourceRows.map(row => row.querySelector(selector)!.getBoundingClientRect().left);
            return Math.max(...xs) - Math.min(...xs);
          }),
          transform: getComputedStyle(document.getElementById("app")!).transform,
          zoom: getComputedStyle(document.getElementById("app")!).zoom,
        };
      });
      const label = width + "px " + locale;
      expect(geometry.scroll, label).toBeLessThanOrEqual(geometry.viewport);
      expect(geometry.collisions, label).toEqual([]);
      expect(geometry.clipped, label).toEqual([]);
      expect(geometry.targetWidth, label).toBeGreaterThanOrEqual(65);
      expect(geometry.targetEdges, label).toBeLessThanOrEqual(1);
      expect(geometry.periodOverlap, label).toEqual([]);
      expect(geometry.logDrift, label).toBeLessThanOrEqual(1);
      expect(geometry.taglineDrift, label).toBeLessThanOrEqual(1);
      expect(Math.max(...geometry.sourceAxes), label).toBeLessThanOrEqual(1);
      expect(geometry.transform).toBe("none");
      expect(geometry.zoom).toBe("1");
      await expect(page.locator('#result-head [data-table-sort="total"]')).toBeVisible();
    }
    for (const selector of ["#target-year", "#target-era", "#presence-mode-toggle", "#selection-panel-toggle"]) {
      const control = page.locator(selector);
      await control.scrollIntoViewIfNeeded();
      const before = await control.boundingBox();
      await control.focus();
      expect(await control.boundingBox(), selector + " focus shift").toEqual(before);
    }
    await page.locator("#result-body .table-profile-action").first().click();
    await expect(page.locator("#profile-workspace .profile-compact-header")).toBeVisible();
    await expect(page.locator("main:visible")).toHaveCount(1);
    await expect(page.locator("#time-workspace")).toHaveAttribute("inert", "");
    await expect(page.locator("#profile-workspace .nested-page-breadcrumb")).toBeVisible();
    await expect(page.locator("#profile-lookup")).toBeHidden();
    const profile = await page.evaluate(() => {
      const controls = [...document.querySelectorAll<HTMLElement>("#profile-content .profile-compact-controls > *")];
      return {
        scroll: document.documentElement.scrollWidth,
        controls: controls.length,
        clipped: controls.some(el => el.scrollWidth > el.clientWidth + 1),
      };
    });
    expect(profile.controls, "compact profile controls must actually be inspected").toBeGreaterThanOrEqual(4);
    expect(profile.scroll, "profile at " + width).toBeLessThanOrEqual(width);
    expect(profile.clipped).toBe(false);
    await page.locator('#profile-workspace [data-research-back]').click();
    await page.locator("#selection-panel-toggle").click();
    const picker = page.locator("#selection-panel");
    await expect(picker).toBeVisible();
    const box = (await picker.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y + box.height).toBeLessThanOrEqual(900);
    await page.keyboard.press("Escape");
    await expect(page.locator("#selection-panel-toggle")).toBeFocused();
  }
});
