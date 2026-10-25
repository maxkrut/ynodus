import { checkSourceExplanations } from "./production-smoke-support";
import { expect, test, type Page } from "@playwright/test";
import { countryForestFixture } from "../fixtures/layout.mjs";
import { collectWholeTree } from "./tree-sheet-support";

async function ready(page: Page) {
  await expect(page.locator("#result-body tr[data-result-role]").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#live-status")).toHaveAttribute("data-busy", "false");
}

test("full audit: restoring the same Min samples value completes the pending query", async ({ page }) => {
  await page.goto("/?lang=en"); await ready(page);
  const field = page.locator("#min-result-samples");
  const before = await page.locator("#result-body").innerText();
  for (const value of ["5", "7", "0"]) {
    await field.fill(value); await ready(page);
    await field.fill("");
    await expect(page.locator("#export-csv")).toBeDisabled();
    await field.fill(value); await ready(page);
    await expect(page.locator("#export-csv")).toBeEnabled();
    if (value === "5") expect(await page.locator("#result-body").innerText()).toBe(before);
  }
});

test("full audit: unavailable URL countries and conflicting presets are disclosed", async ({ page }) => {
  await page.goto("/?lang=en&countries=RUS,ZZZ&presence=all"); await ready(page);
  await expect(page.locator("#workspace-link-note")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("countries")).toBe("RUS");
  await expect(page.locator("#stat-selected")).toHaveText("1");
  await page.goto("/?lang=en&countries=ZZZ&presence=all");
  await expect(page.locator("#workspace-link-note")).toBeVisible();
  await expect(page.locator("#stat-selected")).toHaveText("0");
  await expect(page.locator("#export-csv")).toBeDisabled();
  await expect(page.locator("#result-body tr[data-result-role]")).toHaveCount(0);
  await page.goto("/?lang=en&countries=CHN&preset=slavic&presence=any"); await ready(page);
  await expect(page.locator("#workspace-link-note")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("preset")).toBeNull();
  expect(new URL(page.url()).searchParams.get("countries")).toBe("CHN");
  await expect(page.locator("#selection-panel-toggle")).not.toHaveAttribute("aria-label", /Slavic/);
  await expect(page.locator("#time-workspace")).not.toContainText("Slavic");
  await page.goto("/?lang=en"); await ready(page);
  await expect(page.locator("#workspace-link-note")).toBeHidden();
  expect(new URL(page.url()).searchParams.get("preset")).toBe("slavic");
});

test("full audit: profile reveal labels match the increment and final focus stays in the profile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/data/hras-index.json', route => route.fulfill({ json: countryForestFixture() }));
  await page.goto("/?view=profile&clade=R-SYN-BRANCH&lang=en");
  const nodes = page.locator("#profile-content .evidence-tree-node");
  await expect(nodes).toHaveCount(21);
  expect(await collectWholeTree(page,'R-SYN-BRANCH')).toHaveLength(601);
  await expect(page.locator('.tree-sheet-scroll')).toBeFocused();
  const scroll = await page.evaluate(() => scrollY);
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => !!document.activeElement?.closest("#profile-workspace"))).toBe(true);
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(scroll - 100);
});

test("full audit: Formed groups and same-age counts are visible in the profile", async ({ page }) => {
  await page.goto("/?lang=en&countries=RUS&presence=any&target=5449&window=300&min=5"); await ready(page);
  const row = page.locator('#result-body tr[data-result-role]').filter({ has: page.locator('[data-open-result-detail="J-Z600"]') });
  await expect(row.locator(".formed-branch-summary-text")).toContainText("age groups");
  await expect(row.locator(".formed-branch-dialog")).toHaveCount(0);
  await row.locator('[data-open-result-detail="J-Z600"]').click();
  const groups = page.locator("#profile-content .profile-formed-context");
  await expect(groups.locator(".profile-formed-group")).toHaveCount(2);
  await expect(groups).toContainText("J-Z615");
  await expect(groups).toContainText("Same-age descendants: 3 · Groups: 1");
  await expect(page.locator("#profile-content .evidence-tree-node.same-formed").first()).toBeVisible();
});
test("full audit: mobile provenance text fits its link targets in every locale", async ({ page }) => {
  await page.goto("/"); await ready(page);
  await checkSourceExplanations(page);
  for (const width of [320, 390, 760, 761]) {
    await page.setViewportSize({ width, height: 844 });
    for (const locale of ["ru", "en",]) {
      await page.locator("#locale-switcher").selectOption(locale);
      const invalid = await page.locator(".provenance-links").evaluateAll(navs => navs.flatMap(nav => [...nav.children].flatMap(link => {
        const box = link.getBoundingClientRect();
        const range = document.createRange(); range.selectNodeContents(link);
        const text = range.getBoundingClientRect();
        return text.left < box.left - 1 || text.right > box.right + 1 ? [link.textContent] : [];
      })));
      expect(invalid, `${width} ${locale}`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  }
});

test("full audit: large same-age groups remain visible in the profile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const count = 86;
  const fixture = {
    format: "ynodus/hras-index-v3", formatVersion: 3,
    source: "Synthetic audit fixture", sourceUrl: "https://example.test/",
    sourceManifestUrl: "https://example.test/manifest", licenseNotice: "Synthetic, no personal records",
    sourceLicenses: { applicationCode: "Apache-2.0", referenceTree: "Synthetic", hrasSourceCode: "Apache-2.0" },
    treeVersion: "audit-1", treeOfficialVersion: "audit-2", computedDate: "2026-01-01", generatedAt: "2026-01-02",
    hrasManifestSampleCount: count, projectIds: ["R1a"], countryCodes: ["RUS"], countryCounts: [count],
    nodeIds: Array.from({ length: count }, (_, i) => `R-AUDIT-${i}`),
    nodes: Array.from({ length: count }, (_, i) => [0, i ? Math.floor((i - 1) / 3) : -1, 4000]),
    samples: Array.from({ length: count }, (_, i) => [i, 0, 1]),
  };
  await page.route("**/data/hras-index.json", route => route.fulfill({ json: fixture }));
  await page.goto("/?lang=en&countries=RUS&presence=any&target=4000&window=0&min=0"); await ready(page);
  await expect(page.locator(".formed-branch-summary-text")).toContainText("85 descendant subclades");
  await page.locator('[data-open-result-detail="R-AUDIT-0"]').click();
  const groups = page.locator("#profile-content .profile-formed-context");
  await expect(groups).toContainText("Same-age descendants: 85 · Groups: 1");
  await expect(groups.locator(".profile-same-formed-members > span")).toHaveCount(86);
  await expect(page.locator("#profile-content .evidence-tree-node.same-formed")).toHaveCount(85);
  expect(await groups.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
});
