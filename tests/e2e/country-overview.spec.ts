import { expect, test, type Page } from "@playwright/test";
import {countryForestFixture} from "../fixtures/layout.mjs";

async function ready(page: Page) {
  await page.route('**/data/hras-index.json',route=>route.fulfill({json:countryForestFixture()}));
  await page.goto("/?lang=ru&countries=RUS&target=5000&window=300&min=0&presence=any");
  await expect(page.locator("#result-body tr[data-result-role]").first()).toBeVisible({ timeout: 20_000 });
}

const numberOf = (value: string) => Number(value.replace(/[^0-9]/g, ""));

test("whole-country overview is disjoint, restorable and distinct from branch evidence", async ({ page }) => {
  await ready(page);
  await page.locator('[data-research-view="country-overview"]').click();
  await page.locator("#country-overview-select").selectOption("RUS");
  await page.locator('#country-overview-form button[type="submit"]').click();
  await expect(page.locator("#country-overview-content h3").first()).toContainText("RUS");

  const total = numberOf(await page.locator("#country-overview-content .country-overview-total > strong").innerText());
  const groupTotals = await page.locator("#country-overview-content .country-overview-groups em")
    .allTextContents();
  expect(groupTotals.reduce((sum, value) => sum + numberOf(value), 0)).toBe(total);
  await expect(page).toHaveURL(/view=country-overview/);
  await expect(page).toHaveURL(/country=RUS/);

  await page.reload();
  await expect(page.locator("#country-overview-content h3").first()).toContainText("RUS", { timeout: 20_000 });
  await page.locator("#country-overview-content .tree-sheet [data-country-evidence][data-country-evidence-anchor]").first().click();
  await expect(page.locator("#country-evidence-workspace")).toBeVisible();
  await expect(page.locator("#country-evidence-content .country-evidence-identity")).toContainText("RUS");
  await expect(page).toHaveURL(/from=overview/);
  await page.reload();
  await expect(page.locator("#country-evidence-content .country-evidence-identity")).toContainText("RUS", { timeout: 20_000 });
  await page.locator("[data-back-to-profile]").click();
  await expect(page.locator("#country-overview-workspace")).toBeVisible();
  await expect(page.locator("#country-overview-content h3").first()).toContainText("RUS", { timeout: 20_000 });
  expect(numberOf(await page.locator("#country-overview-content .country-overview-total > strong").innerText())).toBe(total);
});

test("large profile tree is progressive and inactive research DOM is released", async ({ page }) => {
  await page.route('**/data/hras-index.json',r=>r.fulfill({json:countryForestFixture()}));
  await page.goto('/?lang=ru&view=profile&clade=R-SYN-ROOT');
  await expect(page.locator('.profile-compact-header h3')).toHaveText('R-SYN-ROOT');
  const nodes=page.locator('#profile-content [data-tree-node]');
  await expect(nodes).toHaveCount(22);
  await page.locator('[data-evidence-tree-more="R-SYN-BRANCH"]').click();
  await expect(nodes).toHaveCount(42);

  await page.locator('.research-entrypoints [data-research-view="time"]').click();
  await expect(page.locator("#time-workspace")).toBeVisible();
  await expect(page.locator("#profile-content")).toBeEmpty();
  await expect(page.locator("#country-evidence-content")).toBeEmpty();
});
