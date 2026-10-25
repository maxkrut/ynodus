import {expect,test} from "@playwright/test";
import {layoutFixture,layoutQuery} from "../fixtures/layout.mjs";
import {openStandaloneProfile} from "./production-smoke-support";
test("compact profile keeps partition totals, country filters and nested navigation",async({page})=>{
 const data=layoutFixture();const start=data.nodeIds.indexOf("R-SYN-100");const sampleRows=data.samples.filter(row=>row[0]>start&&row[0]<=start+18);
 const total=sampleRows.reduce((sum,row)=>sum+row[2],0),russian=sampleRows.filter(row=>row[1]===0).reduce((sum,row)=>sum+row[2],0);
 await page.route("**/data/hras-index.json",route=>route.fulfill({json:data}));await page.goto(layoutQuery);await openStandaloneProfile(page,"R-SYN-100");
 for(const width of [1440,768,390]){await page.setViewportSize({width,height:900});for(const locale of ["ru","en"]){
  await page.locator("#locale-switcher").selectOption(locale);await expect(page.locator("[data-profile-scope-total]")).toHaveText(String(total));
  const root=page.locator('[data-tree-node="R-SYN-100"]');await expect(root.locator("[data-branch-tree-all]")).toHaveText(String(total));
  const nodes=page.locator("#profile-content [data-tree-node]");await expect(nodes).toHaveCount(19);
  await page.locator("#profile-country-filter").selectOption("RUS");await expect(nodes).toHaveCount(13);
  await expect(page.locator("[data-profile-country-reset]")).toBeEnabled();await page.locator("[data-profile-country-reset]").click();await expect(nodes).toHaveCount(19);
  const search=page.locator("[data-profile-tree-search]");await search.fill("no-such-subclade");await expect(nodes).toHaveCount(0);await search.fill("");await expect(nodes).toHaveCount(19);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }}
 await page.locator('#profile-content [data-tree-node="R-SYN-100"] [data-country-evidence="RUS"]').click();
 await expect(page.locator("#country-evidence-content [data-branch-scope-selected]")).toContainText(String(russian));
 await page.locator('#country-evidence-content [data-tree-node="R-SYN-201"] .tree-node-col [data-country-evidence-anchor]').click();
 await expect(page.locator("#country-evidence-content .profile-formed strong")).toHaveText("R-SYN-201");await page.goBack();await expect(page.locator("#country-evidence-content .profile-formed strong")).toHaveText("R-SYN-100");
});
