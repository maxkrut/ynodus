import fs from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { compact } from "../../scripts/semantic-audit/fixtures.mjs";

const fixture = () => {
  const data=compact([-1,-1,-1,-1,-1],[490,510,400,600,null],
    [[0,0,1],[1,1,1],[2,0,7],[2,1,2],[3,0,3],[3,1,8],[4,2,4]]);
  data.countryCodes=["PNG","AUS","NZL"]; data.projectIds=["R"];
  data.nodeIds=["R-SYN-PNG-ONLY","R-SYN-AUS-ONLY","R-SYN-SHARED-YOUNGER","R-SYN-SHARED-OLDER","R-SYN-UNDATED"];
  return data;
};

for (const width of [390,1440]) test(`zero requires all selected countries in results, neighbors, density and CSV at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:1000});
  await page.route("**/data/hras-index.json",route=>route.fulfill({json:fixture()}));
  await page.goto("/?lang=ru&countries=PNG,AUS&presence=all&target=490&window=0&min=0");
  const rows=page.locator("#result-body tr[data-result-role]"), minimum=page.locator("#min-result-samples");
  await expect(page.locator("[data-suggest-ybp]")).toHaveCount(2);
  await expect(rows).toHaveCount(0);
  await expect(page.locator("#country-minimum-reset-note")).toBeHidden();
  await expect(page.locator("#target-density-summary")).toContainText("2");
  await expect(page.locator('[data-suggest-ybp="510"]')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await minimum.fill("1");
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("R-SYN-PNG-ONLY");
  // The chart's wider intervals contain both countries, even though the ±0
  // table pool only contains PNG. Each surface applies its own temporal bounds.
  await expect(page.locator("#target-density-summary")).toContainText("2");
  await minimum.fill("0");
  await expect(page.locator("[data-suggest-ybp]")).toHaveCount(2);
  await expect(rows).toHaveCount(0);
  await expect(page.locator("#target-density-summary")).toContainText("2");
  await minimum.blur();
  await page.mouse.move(0,0);
  await page.keyboard.press("Escape");
  await page.screenshot({path:`output/strict-zero/empty-${width}.png`,fullPage:true});
  await page.locator('[data-suggest-ybp="600"]').click();
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("R-SYN-SHARED-OLDER");
  await expect(rows).toContainText("PNG 3");
  await expect(rows).toContainText("AUS 8");
  await expect(rows.locator(".country-pill-inactive")).toHaveCount(0);
  await expect(minimum).toHaveValue("0");
  await expect(page.locator("#presence-mode-toggle")).toHaveAttribute("aria-checked","true");
  const download=page.waitForEvent("download"); await page.locator("#export-csv").click();
  const csv=await fs.readFile((await (await download).path())!,"utf8");
  expect(csv).toContain("all_selected_countries_at_zero_minimum");
  expect(csv).toContain("R-SYN-SHARED-OLDER");
  await page.reload();
  await expect(rows).toHaveCount(1);
  await expect(minimum).toHaveValue("0");
});

test("a selected country without dated evidence blocks strict-zero results and every neighbor",async({page})=>{
  await page.route("**/data/hras-index.json",route=>route.fulfill({json:fixture()}));
  await page.goto("/?lang=ru&countries=PNG,AUS,NZL&presence=all&target=490&window=0&min=0");
  await expect(page.locator("#query-results-jump")).toBeEnabled();
  await expect(page.locator("#result-body tr[data-result-role]")).toHaveCount(0);
  await expect(page.locator("[data-suggest-ybp]")).toHaveCount(0);
  await expect(page.locator("#country-minimum-reset-note")).toBeHidden();
  await expect(page).toHaveURL(/presence=all/);
  await page.locator('[data-presence="any"]').click();
  await expect(page.locator("#result-body tr[data-result-role]")).toHaveCount(1);
});
