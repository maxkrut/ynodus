import { expect, test, type Locator, type Page } from "@playwright/test";

export async function openStandaloneProfile(page: Page, subclade: string): Promise<void> {
  await page.locator('[data-research-view="profile"]').click();
  await page.locator("#profile-clade-search").fill(subclade);
  await page.locator('#profile-lookup button[type="submit"]').click();
  await expect(page.locator("#profile-content .profile-compact-identity h3")).toHaveText(subclade);
}

export async function checkSourceExplanations(page: Page): Promise<void> {
  await expect(page.locator("#provenance-notes")).toBeHidden();
  for (const id of ["source-sync", "snapshot-notes", "hras-date", "yfull-date", "index-date"]) {
    const trigger = page.locator(`.app-header [data-annotation="${id}"]`);
    await trigger.click();
    const panel = page.locator("#context-annotation");
    await expect(panel).toBeVisible();
    await expect(panel).not.toHaveText("");
    if (id === "source-sync") await expect(panel).toContainText("YFull");
    if (id === "snapshot-notes") await expect(panel).toContainText(/не хранятся|stores no/i);
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(trigger).toBeFocused();
  }
}

export async function setCrossingEnabled(page: Page, enabled: boolean): Promise<void> {
  await page.locator("#include-crossing").setChecked(enabled);
}

export async function setPresenceMode(page: Page, mode: "any" | "all"): Promise<void> {
  const toggle = page.locator("#presence-mode-toggle");
  if (await toggle.getAttribute("value") !== mode) await toggle.locator(`[data-presence="${mode}"]`).click();
}

export async function fillMinResultSamples(page: Page, value: string): Promise<void> {
  await page.locator("#min-result-samples").fill(value);
}

export async function focusDialogBoundary(
  dialog: Locator,
  boundary: "first" | "last",
): Promise<Locator> {
  const marker = `data-e2e-focus-${boundary}`;
  await dialog.evaluate((root, { boundary: requestedBoundary }) => {
    const selector = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled]):not([type='hidden'])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "summary",
      "[contenteditable='true']",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");
    const focusable = [...root.querySelectorAll<HTMLElement>(selector)]
      .filter((element) => {
        if (element.getClientRects().length === 0 || element.getAttribute("aria-hidden") === "true") return false;
        if (element.closest("[inert]")) return false;
        const closedDetails = element.closest<HTMLDetailsElement>("details:not([open])");
        return !closedDetails || (element.tagName === "SUMMARY" && element.parentElement === closedDetails);
      });
    const first = focusable[0];
    const last = focusable.at(-1);
    const target = requestedBoundary === "first" ? first : last;
    if (!target) throw new Error(`Dialog has no ${requestedBoundary} focus boundary.`);
    root.querySelectorAll("[data-e2e-focus-first], [data-e2e-focus-last]")
      .forEach((element) => {
        element.removeAttribute("data-e2e-focus-first");
        element.removeAttribute("data-e2e-focus-last");
      });
    first?.setAttribute("data-e2e-focus-first", "");
    last?.setAttribute("data-e2e-focus-last", "");
    target.focus();
  }, { boundary });
  return dialog.locator(`[${marker}]`);
}
