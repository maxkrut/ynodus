import fs from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { compact } from "../../scripts/semantic-audit/fixtures.mjs";

async function start(page: Page, multiple: boolean) {
  const data = compact([-1,-1,-1],[6600,6400,13000],multiple ? [[0,0,3],[1,1,2],[2,0,7]] : [[0,0,3],[1,0,2],[2,0,7]]);
  data.countryCodes=["PNG","AUS","NZL"]; data.projectIds=["R"];
  data.nodeIds=["R-SYN-ONE","R-SYN-TWO","R-SYN-OLDER"];
  await page.route("**/data/hras-index.json",route=>route.fulfill({json:data}));
  await page.addInitScript(()=>{
    (window as any).offerRequests=0;
    const send=Worker.prototype.postMessage;
    Worker.prototype.postMessage=function(message: any,...args: any[]) {
      if(message.type==="analyze") (window as any).offerRequests++;
      return (send as any).call(this,message,...args);
    };
  });
  await page.goto(`/?lang=ru&target=6600&window=300&min=${multiple?11:13}&presence=all&crossing=1&countries=${multiple?"PNG,AUS":"PNG"}`);
}

for(const width of [390,1440]) for(const multiple of [false,true]) {
  test(`minimum change is offered and requires a click at ${width}, multiple=${multiple}`,async({page})=>{
    const errors: string[]=[]; page.on("pageerror",error=>errors.push(error.message));
    await page.setViewportSize({width,height:1000});
    await start(page,multiple);
    const note=page.locator("#country-minimum-reset-note"), action=note.locator("button");
    const toggle=page.locator("#presence-mode-toggle");
    await expect(note).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-checked","true");
    await expect(page.locator("#min-result-samples")).toBeEnabled();
    await expect(page).toHaveURL(/presence=all/);
    await expect(page.locator("#result-body tr[data-result-role]")).toHaveCount(0);
    expect(await page.evaluate(()=>(window as any).offerRequests)).toBe(1);
    for(const locale of ["ru","en",]) {
      await page.locator("#locale-switcher").selectOption(locale);
      await expect(note).toBeVisible();
      await expect(action).toHaveText({ru:"Показать все ветви",en:"Show all branches",}[locale]!);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      if (width <= 760) expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await page.screenshot({path:`output/minimum-offer/${width}-${multiple}-${locale}.png`,fullPage:true});
    }
    expect(await page.evaluate(()=>(window as any).offerRequests)).toBe(1);
    await page.reload();
    await expect(note).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-checked","true");
    await action.focus(); await page.keyboard.press("Enter");
    await expect(note).toBeHidden();
    await expect(toggle).toHaveAttribute("aria-checked","false");
    await expect(page).toHaveURL(/presence=any/);
    await expect(page).toHaveURL(/crossing=1/);
    await expect(page.locator("#min-result-samples")).toBeDisabled();
    await expect(page.locator("#export-csv")).toBeEnabled();
    await expect(page.locator("#result-body tr[data-result-role]")).toHaveCount(2);
    expect(await page.evaluate(()=>(window as any).offerRequests)).toBe(2);
    const download=page.waitForEvent("download"); await page.locator("#export-csv").click();
    const csv=await fs.readFile((await (await download).path())!,"utf8");
    expect(csv).toContain("not_applied_in_all_branches_mode");
    expect(csv).toContain("R-SYN-ONE"); expect(csv).toContain("R-SYN-TWO");
    await page.reload();
    await expect(toggle).toHaveAttribute("aria-checked","false");
    await expect(note).toBeHidden();
    expect(errors).toEqual([]);
  });
}

test("changing a query invalidates its offer, and a qualifying country does not show one",async({page})=>{
  await start(page,true);
  const note=page.locator("#country-minimum-reset-note");
  await expect(note).toBeVisible();
  const hidden=await page.evaluate(()=>{
    const field=document.querySelector<HTMLInputElement>("#min-result-samples")!;
    field.value="1"; field.dispatchEvent(new Event("input",{bubbles:true}));
    return document.querySelector<HTMLElement>("#country-minimum-reset-note")!.hidden;
  });
  expect(hidden).toBe(true);
  await expect(page.locator("#presence-mode-toggle")).toHaveAttribute("aria-checked","true");
  await expect(page.locator("#query-results-jump")).toBeEnabled();
  await expect(page.locator("#export-csv")).toBeDisabled();
  await expect(note).toBeHidden();
});
