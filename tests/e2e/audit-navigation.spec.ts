import { populatedTimeUrl } from "../fixtures/time-url";
import { expect, test, type Page } from "@playwright/test";

async function ready(page: Page) {
  await expect(page.locator("#result-body tr[data-result-role]").first()).toBeVisible({ timeout: 20_000 });
}
async function lookup(page: Page, clade: string) {
  await page.locator('.research-entrypoints [data-research-view="profile"]').click();
  await page.locator("#profile-clade-search").fill(clade);
  await page.locator('#profile-lookup button[type="submit"]').click();
  await expect(page.locator("#profile-content h3").first()).toHaveText(clade);
}

test("audit: reload and direct profile/country links preserve query, language and route", async ({ page, context }) => {
  await page.goto(populatedTimeUrl); await ready(page);
  await page.locator("#locale-switcher").selectOption("en");
  await page.locator("#target-year").fill("5000");
  await page.locator("#max-delta-ybp").fill("500");
  await page.locator("#include-crossing").check();
  await lookup(page, "R-Z645");
  const profileUrl = page.url();
  await page.reload();
  await expect(page.locator("#profile-content h3").first()).toHaveText("R-Z645", { timeout: 20_000 });
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.locator('#profile-content [data-tree-node="R-Z645"] [data-country-evidence="RUS"]').click();
  await expect(page.locator("#country-evidence-content .country-evidence-identity")).toContainText("RUS");
  const countryUrl = page.url();
  await page.reload();
  await expect(page.locator("#country-evidence-content .country-evidence-identity")).toContainText("RUS", { timeout: 20_000 });
  await page.goBack();
  await expect(page.locator("#profile-content h3").first()).toHaveText("R-Z645");
  await page.goForward();
  await expect(page.locator("#country-evidence-workspace")).toBeVisible();
  await page.locator('.research-entrypoints [data-research-view="time"]').click();
  await expect(page.locator("#target-year")).toHaveValue("5000");
  await expect(page.locator("#max-delta-ybp")).toHaveValue("500");
  await expect(page.locator("#include-crossing")).toBeChecked();
  for (const [url, selector, identity] of [[profileUrl, "#profile-content h3", "R-Z645"],
    [countryUrl, "#country-evidence-content .country-evidence-identity", "RUS"]]) {
    const direct = await context.newPage();
    await direct.goto(url);
    await expect(direct.locator(selector).first()).toContainText(identity, { timeout: 20_000 });
    await expect(direct.locator("#target-year")).toHaveValue("5000");
    await direct.close();
  }
});

test("audit: retired branch URLs become whole-snapshot country searches and history restores each query", async ({ page }) => {
  await page.goto("/?view=time&lang=en&target=5450&window=300&min=5&countries=RUS,POL&presence=any&branch=R-Z645");
  await ready(page);
  await expect(page.locator("#workspace-link-note")).toBeVisible();
  await expect(page).not.toHaveURL(/branch=/);
  const before = await page.locator("#result-body [data-open-profile-subclade]").evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-open-profile-subclade")));
  await page.reload(); await ready(page);
  await expect(page.locator("#tab-subclades")).toHaveCount(0);
  expect(await page.locator("#result-body [data-open-profile-subclade]").evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-open-profile-subclade")))).toEqual(before);
  await lookup(page, "R-Z645");
  await page.locator('.research-entrypoints [data-research-view="time"]').click();
  await page.locator("#target-year").fill("5000");
  await page.goBack();
  await expect(page.locator("#profile-workspace")).toBeVisible();
  await expect(page.locator("#target-year")).toHaveValue("3501");
  await page.goForward();
  await expect(page.locator("#time-workspace")).toBeVisible();
  await expect(page.locator("#target-year")).toHaveValue("5000");
});

test("audit: invalid URL settings are explicit while retired branch scope does not discard countries", async ({ page }) => {
  await page.goto("/?lang=en&target=-1&window=NaN&branch=R-NONEXISTENT-AUDIT&countries=RUS");
  await expect(page.locator("#workspace-link-note")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("#target-year")).toHaveValue("3500");
  await expect(page.locator("#max-delta-ybp")).toHaveValue("300");
  await expect(page.locator("#stat-selected")).toHaveText("1");
  await expect(page).not.toHaveURL(/branch=/);
});
