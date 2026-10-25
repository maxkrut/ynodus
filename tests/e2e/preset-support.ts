import type { Page } from "@playwright/test";

/** Use the same disclosure controls a reader uses before choosing or inspecting a set. */
export async function revealPreset(page: Page, key: string): Promise<void> {
  const mobile = page.locator("[data-toggle-presets]");
  if (await mobile.isVisible() && await mobile.getAttribute("aria-expanded") === "false") await mobile.click();
  const group = page.locator("[data-preset-group]")
    .filter({ has: page.locator(`[data-country-preset-option="${key}"]`) });
  if (await group.getAttribute("open") === null) await group.locator(":scope > summary").click();
}
