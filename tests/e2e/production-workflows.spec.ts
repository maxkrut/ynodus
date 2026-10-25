import { expect, test } from "@playwright/test";
import {
  setCrossingEnabled,
  setPresenceMode,
} from "./production-smoke-support";

test("ordinary time, country and profile workflows do not emit browser errors", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.setViewportSize({ width: 430, height: 900 });
  await page.goto("/");
  await expect(page.locator("#results")).toBeVisible({ timeout: 20_000 });
  await page.locator("#locale-switcher").selectOption("en");
  await setPresenceMode(page, "all");
  await page.locator("#selection-panel-toggle").click();
  await page.locator("#country-search").fill("CHN");
  await page.locator("#country-search").fill("");
  await page.keyboard.press("Escape");
  await page.locator('.research-entrypoints [data-research-view="profile"]').click();
  await page.locator("#profile-clade-search").fill("R-Z645");
  await page.locator('#profile-lookup button[type="submit"]').click();
  await expect(page.locator("#profile-content h3").first()).toContainText("R-Z645", { timeout: 20_000 });
  await page.locator('#profile-content [data-tree-node="R-Z645"] [data-country-evidence="RUS"]').click();
  await expect(page.locator("#country-evidence-content .country-evidence-identity")).toContainText("RUS");

  expect(browserErrors).toEqual([]);
});

test("WCAG text spacing keeps the time, country and profile workspaces inside the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("#results tbody tr[data-result-role]").first()).toBeVisible({ timeout: 20_000 });
  await page.locator("#locale-switcher").selectOption("ru");
  await page.addStyleTag({
    content: `
      * { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; }
      p { margin-bottom: 2em !important; }
    `,
  });

  const expectNoPageOverflow = async (state: string) => {
    const geometry = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      slider: (() => {
        const rect = document.querySelector<HTMLElement>("#target-slider")!.getBoundingClientRect();
        return { left: rect.left, right: rect.right };
      })(),
    }));
    expect(geometry.documentWidth, `${state} document width`).toBeLessThanOrEqual(geometry.viewportWidth);
    expect(geometry.slider.left, `${state} slider left`).toBeGreaterThanOrEqual(-1);
    expect(geometry.slider.right, `${state} slider right`).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  };

  await expectNoPageOverflow("time workspace");
  await page.locator("#selection-panel-toggle").click();
  const dialog = page.locator("#selection-panel");
  await expect(dialog).toBeVisible();
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(390);
  await page.keyboard.press("Escape");
  await page.locator("#result-body .table-profile-action").first().click();
  await expect(page.locator("#profile-workspace")).toBeVisible();
  await expectNoPageOverflow("profile workspace");
});

test("forced colors preserves selected presence, optional Crossing and keyboard focus", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    forcedColors: "active",
    colorScheme: "light",
  });
  const page = await context.newPage();
  try {
    await page.goto("/");
    await expect(page.locator("#results tbody tr[data-result-role]").first()).toBeVisible({ timeout: 20_000 });
    await setCrossingEnabled(page, true);
    await expect(page.locator("#crossing-results-section")).toBeVisible({ timeout: 20_000 });
    await page.locator("#selection-panel-toggle").focus();
    await setPresenceMode(page, "all");
    await expect(page.locator("#live-status")).toHaveAttribute("data-busy", "false");
    await page.keyboard.press("Tab");
    await page.locator("#selection-panel-toggle").focus();
    const styles = await page.evaluate(() => {
      const paint = (selector: string) => {
        const style = getComputedStyle(document.querySelector<HTMLElement>(selector)!);
        return {
          color: style.color,
          background: style.backgroundColor,
          border: style.borderColor,
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
          boxShadow: style.boxShadow,
        };
      };
      return {
        crossingOption: paint("#query-crossing-control.is-on"),
        selectedPresence: paint("#presence-mode-toggle.is-on"),
        focusedCountry: paint("#selection-panel-toggle"),
        currentDensity: paint(".density-result-range"),
        ordinaryDensity: paint(".density-cell.context:not(.has-current-results) .density-bar"),
      };
    });

    expect(styles.crossingOption.border).not.toBe("rgba(0, 0, 0, 0)");
    expect(styles.selectedPresence.border).not.toBe("rgba(0, 0, 0, 0)");
    expect(parseFloat(styles.currentDensity.outlineWidth)).toBeGreaterThanOrEqual(2);
    expect(styles.currentDensity.outlineStyle).not.toBe("none");
    expect(
      styles.focusedCountry.outlineStyle !== "none"
      || styles.focusedCountry.boxShadow !== "none",
    ).toBeTruthy();
  } finally {
    await context.close();
  }
});

test("reduced motion removes nonessential transition time", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("#results")).toBeVisible({ timeout: 20_000 });
  const motion = await page.evaluate(() => {
    const control = document.querySelector<HTMLElement>(".research-entrypoints button")!;
    const style = getComputedStyle(control);
    return {
      preference: matchMedia("(prefers-reduced-motion: reduce)").matches,
      durations: style.transitionDuration.split(",").map((value) => Number.parseFloat(value) || 0),
    };
  });
  expect(motion.preference).toBeTruthy();
  expect(Math.max(...motion.durations)).toBeLessThanOrEqual(0.001);
});
