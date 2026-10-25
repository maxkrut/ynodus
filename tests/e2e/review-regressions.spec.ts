import { expect, test } from "@playwright/test";
import { countryForestFixture } from "../fixtures/layout.mjs";
import { resultStatesFixture, resultStateQuery } from "../fixtures/result-states.mjs";
import { collectWholeTree } from "./tree-sheet-support";

test("country search has no redundant tooltip and Escape restores picker focus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/data/hras-index.json", route => route.fulfill({ json: resultStatesFixture() }));
  await page.goto(resultStateQuery);
  await expect(page.locator("#result-count")).toHaveText("120");
  const opener = page.locator("#selection-panel-toggle");
  await opener.click();
  await expect(page.locator("#country-search")).toBeFocused();
  await page.locator("#country-search").hover();
  await expect(page.locator("#country-search")).not.toHaveAttribute("data-tooltip", /./);
  await expect(page.locator("#context-annotation")).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(page.locator("#selection-panel")).toBeHidden();
  await expect(opener).toBeFocused();
  await expect(opener).toHaveAttribute("aria-expanded", "false");
});

test("profile disclosure extends a stable preorder prefix through the final page", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/data/hras-index.json", route => route.fulfill({ json: countryForestFixture() }));
  await page.goto("/?lang=ru&view=profile&clade=R-SYN-BRANCH");
  const nodes = page.locator("[data-profile-tree-view] [data-profile-select]");
  const ids = () => nodes.evaluateAll(elements => elements.map(el => el.getAttribute("data-profile-select")));
  await expect(nodes).toHaveCount(21);
  const initial = await ids();
  expect(initial.slice(0, 4)).toEqual(["R-SYN-BRANCH", "R-SYN-L000", "R-SYN-L001", "R-SYN-L002"]);
  expect(await collectWholeTree(page, 'R-SYN-BRANCH')).toEqual(["R-SYN-BRANCH", ...Array.from({ length: 600 }, (_, i) => `R-SYN-L${String(i).padStart(3, "0")}`)]);
  await expect(page.locator('.tree-sheet-scroll')).toBeFocused();
  expect((await ids()).length).toBeLessThanOrEqual(101);
  await page.screenshot({ path: "output/review-fixes/profile-final.png" });
  expect(errors).toEqual([]);
});

for (const view of ["overview", "branch"] as const) {
  test(`final country tree disclosure retains visible keyboard focus in ${view}`, async ({ page }) => {
    await page.route("**/data/hras-index.json", route => route.fulfill({ json: countryForestFixture() }));
    const overview = view === "overview";
    await page.goto(overview
      ? "/?lang=ru&view=country-overview&country=RUS"
      : "/?lang=ru&view=country&country=RUS&clade=I-SYN-ROOT");
    const parent = page.locator('[data-evidence-tree-toggle="I-SYN-ROOT"]');
    await expect(parent).toBeVisible();if(await parent.getAttribute("aria-expanded")==="false")await parent.click();
    const ids=await collectWholeTree(page,"I-SYN-ROOT");
    expect(ids.filter(id=>id.startsWith("I-SYN-"))).toEqual(["I-SYN-ROOT",...Array.from({length:198},(_,i)=>'I-SYN-L'+String(i).padStart(3,"0"))]);
    const pane=page.locator(".tree-sheet-scroll");await expect(pane).toBeFocused();await expect(pane).toBeInViewport();
    await page.keyboard.press("Tab");expect(await page.evaluate(()=>Boolean(document.activeElement?.closest(".tree-sheet")))).toBe(true);
  });
}

for (const width of [390, 768]) {
  test(`long result lists keep the timeline ahead of the table at ${width}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 844 });
    await page.route("**/data/hras-index.json", route => route.fulfill({ json: resultStatesFixture() }));
    await page.goto(resultStateQuery);
    await expect(page.locator("#result-count")).toHaveText("120");
    await expect(page.locator('#result-body tr[data-result-role="formed"]')).toHaveCount(50);
    const geometry = await page.evaluate(() => ({
      scroll: scrollY,
      timeline: document.querySelector(".timeline-zone")!.getBoundingClientRect().toJSON(),
      results: document.querySelector("#results")!.getBoundingClientRect().toJSON(),
      summary: document.querySelector("#query-results-jump")!.getBoundingClientRect().toJSON(),
      overflow: document.documentElement.scrollWidth - innerWidth,
    }));
    expect(geometry.scroll).toBe(0);
    expect(geometry.timeline.bottom).toBeLessThanOrEqual(geometry.results.top);
    expect(geometry.timeline.top).toBeLessThan(844 * 1.6);
    expect(geometry.overflow).toBe(0);
    if (width === 390) {
      expect(geometry.summary.top).toBeGreaterThanOrEqual(0);
      expect(geometry.summary.bottom).toBeLessThan(844);
      await expect(page.locator("#query-result-count")).toHaveText("Найденные ветви: 120");
      await expect(page.locator("#query-result-date")).toHaveText(await page.locator("#result-query").innerText());
      await page.screenshot({ path: "output/review-fixes/mobile-first-screen.png" });
      await page.locator(".timeline-zone").screenshot({ path: "output/review-fixes/mobile-timeline.png" });
      await page.locator("#query-results-jump").click();
      await expect(page.locator("#result-title")).toBeFocused();
      for (const language of ["en", "ru"]) {
        await page.locator("#locale-switcher").selectOption(language);
        await expect(page.locator("#query-result-date")).toHaveText(await page.locator("#result-query").innerText());
        await expect(page.locator("#query-result-count")).toContainText("120");
      }
      await page.locator("#result-macrogroup-filter").selectOption("I2");
      await expect(page.locator("#query-result-count")).toContainText("60 / 120");
    }
    expect(errors).toEqual([]);
  });
}
