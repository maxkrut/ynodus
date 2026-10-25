import { expect, test } from "@playwright/test";
import { compact } from "../../scripts/semantic-audit/fixtures.mjs";

for (const direction of ["older","younger"] as const) test(`nearest ${direction} date skips empty candidates and opens results`,async({page})=>{
  const data=compact([-1,-1,-1,-1],[490,510,400,600],[[0,0,1],[1,1,1],[2,0,7],[3,1,8]]);
  data.countryCodes=["PNG","AUS","NZL"]; data.projectIds=["R"];
  data.nodeIds=["R-SYN-NEAR-YOUNGER","R-SYN-NEAR-OLDER","R-SYN-VALID-YOUNGER","R-SYN-VALID-OLDER"];
  await page.route("**/data/hras-index.json",route=>route.fulfill({json:data}));
  await page.goto("/?lang=ru&countries=PNG,AUS&presence=all&target=500&window=0&min=5");
  const buttons=page.locator("[data-suggest-ybp]");
  await expect(buttons).toHaveCount(2);
  await expect(page.locator("#result-body")).toContainText("Ближайшие даты с результатами при текущих условиях");
  const date=direction==="older"?600:400;
  await expect(page.locator(`[data-suggest-ybp="${date}"]`)).toContainText("Показать результаты");
  await expect(page.locator('[data-suggest-ybp="490"], [data-suggest-ybp="510"]')).toHaveCount(0);
  await page.screenshot({path:`output/minimum-offer/neighbors-${direction}.png`,fullPage:true});
  await page.locator(`[data-suggest-ybp="${date}"]`).click();
  await expect(page.locator("#result-body tr[data-result-role]")).toHaveCount(1);
  await expect(page.locator("#presence-mode-toggle")).toHaveAttribute("aria-checked","true");
  await expect(page).toHaveURL(new RegExp(`target=${date}(?:&|$)`));
  await expect(page).toHaveURL(/window=0/);
  await expect(page.locator("#min-result-samples")).toHaveValue("5");
  await expect(page.locator("#country-minimum-reset-note")).toBeHidden();
});

test("no dates meeting the minimum means no misleading suggestion",async({page})=>{
  const data=compact([-1,-1],[490,510],[[0,0,1],[1,1,1]]);
  data.countryCodes=["PNG","AUS","NZL"]; data.projectIds=["R"];
  data.nodeIds=["R-SYN-YOUNGER","R-SYN-OLDER"];
  await page.route("**/data/hras-index.json",route=>route.fulfill({json:data}));
  await page.goto("/?lang=ru&countries=PNG,AUS&presence=all&target=500&window=0&min=99");
  await expect(page.locator("#country-minimum-reset-note")).toBeVisible();
  await expect(page.locator("[data-suggest-ybp]")).toHaveCount(0);
  await expect(page).toHaveURL(/presence=all/);
});
