import { expect, test } from "@playwright/test";

test("unknown source age remains unknown in profile and cannot become a dated result", async ({ page }) => {
  const fixture = {
    format: "ynodus/hras-index-v3", formatVersion: 3,
    source: "Synthetic audit fixture", sourceUrl: "https://example.test/",
    sourceManifestUrl: "https://example.test/manifest", licenseNotice: "Synthetic, no personal records",
    sourceLicenses: { applicationCode: "Apache-2.0", referenceTree: "Synthetic", hrasSourceCode: "Apache-2.0" },
    treeVersion: "audit-1", treeOfficialVersion: "audit-2", computedDate: "2026-01-01", generatedAt: "2026-01-02",
    hrasManifestSampleCount: 7, projectIds: ["R1a"], countryCodes: ["RUS"], countryCounts: [7],
    nodeIds: ["R-AUDIT-UNKNOWN", "R-AUDIT-DATED"], nodes: [[0, -1, null], [0, 0, 5450]],
    samples: [[0, 0, 2], [1, 0, 5]],
  };
  await page.route("**/data/hras-index.json", (route) => route.fulfill({ json: fixture }));
  await page.goto("/?view=profile&clade=R-AUDIT-UNKNOWN&lang=en&countries=RUS&presence=any");
  await expect(page.locator("#profile-content h3").first()).toHaveText("R-AUDIT-UNKNOWN", { timeout: 20_000 });
  await expect(page.locator(".profile-compact-age")).toContainText(/formation-age estimate unavailable/i);
  await expect(page.locator("[data-search-profile-formed]")).toHaveCount(0);
  await expect(page.locator("[data-profile-scope-total]")).toHaveText("7");
  await page.locator('.research-entrypoints [data-research-view="time"]').click();
  await expect(page.locator("#result-body [data-open-result-detail]")).toHaveAttribute("data-open-result-detail", "R-AUDIT-DATED");
  await expect(page.locator("#result-body tr[data-result-role]")).toHaveCount(1);
});
