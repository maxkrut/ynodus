import { expect, test, type Page } from "@playwright/test";
import { compact } from "../../scripts/semantic-audit/fixtures.mjs";

async function fixture(page: Page, parents: number[], ages: (number | null)[], samples: number[][]) {
  const data = compact(parents, ages, samples);
  data.countryCodes = ["RUS", "POL", "DEU"];
  await page.route("**/data/hras-index.json", route => route.fulfill({ json: data }));
}
const query = "/?lang=en&countries=RUS,POL&presence=any&target=5500&window=100&min=0";

test("nested source ages and disconnected equal ages have truthful group labels", async ({ page }) => {
  await fixture(page, [-1, 0, 0, -1], [5500, 5600, 5600, 5500], [[1, 0, 3], [2, 1, 5], [3, 0, 2]]);
  await page.goto(query);
  const rows = page.locator('#result-body tr[data-result-role="formed"]');
  await expect(rows).toHaveCount(2);
  const root = rows.filter({ has: page.locator('[data-open-result-detail="SYN-000"]') });
  await expect(root.locator(".formed-branch-summary-text")).toContainText("3 age groups");
  await expect(page.locator('#result-head [data-table-sort="formed"]')).toHaveAttribute("data-tooltip", /not a confidence interval/);
  await root.locator('[data-open-result-detail="SYN-000"]').click();
  const profileGroups = page.locator("#profile-content .profile-formed-context");
  await expect(profileGroups.locator(".profile-formed-group")).toHaveCount(3);
  await expect(profileGroups.locator('[data-profile-formed-event="SYN-001"] time')).toContainText("3,651");
  await expect(profileGroups.locator(".profile-formed-group").first().locator("time")).toContainText("3,551");
  await expect(profileGroups).not.toContainText("Younger estimate");
  const labels = await page.locator("#target-density button").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-tooltip")!));
  const groups = labels.reduce((sum, label) => sum + Number(label.match(/Connected same-age groups: (\d+)/)?.[1] ?? 0), 0);
  expect(groups).toBe(4); // Four connected groups, but only two numeric ages.
});

test("country guidance, empty children and hidden ancestors retain their country scope", async ({ page }) => {
  await fixture(page, [-1, 0, 1, 2, 3, 4, 5], [9000, 8000, 7000, 6500, 6000, 5500, 5400], [[5, 0, 2], [6, 1, 3]]);
  await page.goto(query + "&view=country&country=RUS&clade=SYN-005");
  const country = page.locator("#country-evidence-content");
  await expect(country.locator(".profile-formed strong")).toHaveText("SYN-005");
  await expect(country.locator("[data-tree-node]")).toHaveCount(1);
  await expect(country.locator('[data-tree-node="SYN-005"]')).toBeVisible();
  await expect(country.locator('[data-tree-node="SYN-006"]')).toHaveCount(0);
  const earlier = country.locator(".country-branch-path .ancestry-earlier");
  await expect(earlier.locator("summary")).toHaveAttribute("aria-label", "Show earlier ancestors");
  await earlier.locator("summary").click();
  await expect(earlier.locator("button[data-country-evidence]")).toHaveCount(2);
  await earlier.locator('[data-country-evidence-anchor="SYN-000"]').click();
  await expect(page).toHaveURL(/country=RUS/);
  await expect(country.locator(".profile-formed strong")).toHaveText("SYN-000");
  await expect(country.locator("[data-open-profile-subclade]").first()).toContainText(/all countries/i);
  await country.locator("[data-open-profile-subclade]").first().click();
  await expect(page.locator("[data-profile-scope-total]").first()).toHaveText("5");
  await expect(page.locator('#profile-country-filter option')).toHaveText(['All countries', 'Poland (POL) · 3', 'Russia (RUS) · 2']);
});

test("progressive tree states its full scope while only the first batch is rendered", async ({ page }) => {
  const count = 205;
  await fixture(page, Array.from({ length: count }, (_, i) => i - 1), Array(count).fill(5500), [[count - 1, 0, 2]]);
  await page.goto(query + "&view=profile&clade=SYN-000");
  const tree = page.locator("#profile-content .profile-tree-section");
  await expect(tree.locator(".evidence-tree-node")).toHaveCount(100);
  await expect(tree.locator(".evidence-tree-progress")).toContainText("of 205");
  await tree.locator('[data-evidence-tree-page="next"]').click();
  await tree.locator('[data-evidence-tree-page="next"]').click();
  await expect(tree.locator(".evidence-tree-node")).toHaveCount(205);
  await expect(tree.locator(".evidence-tree-progress")).toContainText("201–205 of 205");
  const last = tree.locator('.evidence-tree-node[data-tree-depth="204"]');
  await expect(last).toHaveAttribute("data-tree-parent", "SYN-203");
  await expect(last.locator('.tree-node-col')).not.toContainText("Parent:");
  await expect(last.locator('.tree-sheet-identity')).toContainText("SYN-204");
  await expect(tree.locator('[data-tree-parent]')).toHaveCount(205);
  await page.setViewportSize({ width: 390, height: 844 });
  const viewport = tree.locator(".tree-sheet-scroll");
  await viewport.evaluate(el => { el.scrollTop = el.scrollHeight; el.scrollLeft = el.scrollWidth; });
  await viewport.screenshot({ path: "output/content-audit/deep-tree-after.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("country controls expose current translated hints and explain filtered select-all", async ({ page }) => {
  await fixture(page, [-1, 0, 0], [5500, 5400, 5300], [[0, 0, 2], [1, 1, 3], [2, 2, 5]]);
  await page.goto(query);
  const toggle = page.locator("#presence-mode-toggle");
  await expect(toggle).toHaveAttribute("title", /any selected country/i);
  await toggle.locator('[data-presence="all"]').click();
  await expect(toggle).toHaveAttribute("title", /all countries/i);
  await page.locator("#locale-switcher").selectOption("ru");
  await expect(toggle).toHaveAttribute("title", /кажд/);
  await expect(toggle).toHaveAttribute("title", await page.locator("#mode-hint").innerText());
  await page.locator("#selection-panel-toggle").click();
  await page.locator("#country-search").fill("RUS");
  await expect(page.locator("[data-country-code]")).toHaveCount(1);
  const all = page.locator('[data-country-action="all"]');
  await expect(all).toHaveAttribute("data-tooltip", /скрыт/);
  await all.click();
  await page.locator("#country-search").fill("");
  await expect(page.locator("[data-country-code]:checked")).toHaveCount(3);
  await page.keyboard.press("Escape");
  await expect(page.locator("#export-csv")).toHaveAttribute("title", /макрогруп/);
});

test("loading, unknown dates and absent selection have distinct localized messages", async ({ page }) => {
  const data = compact([-1], [null], [[0, 0, 2]]);
  data.countryCodes = ["RUS", "POL", "DEU"];
  let release!: () => void;
  const ready = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/data/hras-index.json", async route => { await ready; await route.fulfill({ json: data }); });
  try {
    await page.goto(query);
    await page.locator("#locale-switcher").selectOption("ru");
    await expect(page.locator("#empty-state")).toContainText("Загрузка");
  } finally { release(); }
  await expect(page.locator("#target-density-summary")).toContainText("нет субкладов");
  await expect(page.locator("#target-density-summary")).not.toContainText("после");
  await page.locator("#selection-panel-toggle").click();
  await page.locator('[data-country-action="none"]').click();
  await page.keyboard.press("Escape");
  await expect(page.locator("#target-density-summary")).toContainText("Выберите хотя бы одну страну");
});

test("failed index gives a retry and unavailable density, then recovers", async ({ page }) => {
  const data = compact([-1], [5500], [[0, 0, 2]]);
  data.countryCodes = ["RUS", "POL", "DEU"];
  let attempts = 0;
  await page.route("**/data/hras-index.json", route => ++attempts === 1
    ? route.fulfill({ contentType: "text/html", body: "<!doctype html><title>fallback</title>" })
    : route.fulfill({ json: data }));
  await page.goto(query);
  await expect(page.locator("#target-density-summary")).toContainText("currently unavailable");
  await expect(page.locator(".provenance-date").first()).toContainText("metadata unavailable");
  await page.getByRole("button", { name: "Retry loading" }).click();
  await expect(page.locator('#result-body tr[data-result-role="formed"]')).toHaveCount(1);
  await expect(page.locator("#target-density-summary")).not.toContainText("unavailable");
});
