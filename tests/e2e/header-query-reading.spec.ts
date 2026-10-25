import { checkSourceExplanations } from "./production-smoke-support";
import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { compact } from "../../scripts/semantic-audit/fixtures.mjs";
import { parseCsv } from "../../scripts/semantic-audit/csv.mjs";
import { layoutFixture, layoutQuery } from "../fixtures/layout.mjs";

test("minimum uses temporal country counts and keeps the selected date explicit", async ({ page }) => {
  const data = compact([-1, 0, -1], [18000, 8600, 8600], [[1, 0, 8], [1, 1, 3], [1, 2, 2], [2, 1, 1]]);
  data.countryCodes = ["RUS", "POL", "FRA"];
  data.nodeIds = ["R-SYN-ROOT", "R-SYN-PAIR", "R-SYN-SINGLE"];
  data.projectIds = ["R"];
  await page.route("**/data/hras-index.json", route => route.fulfill({ json: data }));
  await page.goto("/?lang=ru&countries=RUS,POL&presence=all&target=8600&window=0&min=5");
  const rows = page.locator('#result-body tr[data-result-role="formed"]');
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("R-SYN-PAIR");
  await expect(rows.locator(".country-pill")).toHaveCount(2);
  await expect(rows.locator(".country-pill:not(.country-pill-inactive)")).toContainText("RUS");
  await expect(rows.locator(".country-pill-inactive")).toContainText("POL");
  await expect(rows.locator(".country-pill-inactive strong")).toHaveText("3");
  const help = rows.locator('.country-pill-inactive [data-annotation="country-minimum"]');
  await expect(help).toHaveCount(1);
  await expect(rows.locator(".country-pill-inactive")).not.toHaveAttribute("title");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator("#results").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `output/snapshot-country-minimum/flags-${width}.png`, fullPage: true });
  }
  await help.click();
  await expect(page.locator("#context-annotation")).toContainText("во временной выборке");
  await expect(page.locator("#context-annotation")).toContainText("входят в числа");
  await page.screenshot({ path: "output/snapshot-country-minimum/flag-help-390.png", fullPage: true });
  await page.keyboard.press("Escape");
  await expect(rows.locator(".table-total strong")).toHaveText("11");
  await expect(page.locator("#min-result-samples-description")).toHaveText(/0.+все страны.+больше 0.+в окне таблицы и отдельно в каждом баре/);
  await expect(page.locator('#result-head [data-table-sort="delta"]')).toContainText("От выбранной даты");
  const reference = page.locator("#result-head .table-reference-date");
  await expect(reference).toHaveText(/6[\s,]?651 до н\. э\./);
  await expect(page.locator("#result-query")).toContainText(await reference.innerText());
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#export-csv").click()]);
  const csv = parseCsv(await readFile((await download.path())!, "utf8"));
  expect(csv).toHaveLength(1);
  expect(csv[0].total_selected).toBe("11");
  expect(csv[0].count_RUS).toBe("8");
  expect(csv[0].count_POL).toBe("3");
  expect(csv[0].min_result_samples).toBe("5");
  expect(csv[0].min_samples_basis).toBe("per_selected_country_in_temporal_candidate_pool");
  expect(JSON.parse(csv[0].below_minimum_country_counts)).toEqual({ POL: 3 });
  await page.locator("#min-result-samples").fill("9");
  await expect(rows).toHaveCount(0);
  await page.locator("#min-result-samples").fill("3");
  await expect(rows).toHaveCount(1);
  await expect(rows.locator(".country-pill-inactive")).toHaveCount(0);
  await page.locator('#presence-mode-toggle [data-presence="any"]').click();
  await expect(rows).toHaveCount(2);
  await expect(rows.locator(".country-pill-inactive")).toHaveCount(0);
  await expect(page.locator("#min-result-samples")).toBeDisabled();
  await page.locator('#presence-mode-toggle [data-presence="all"]').click();
  await expect(page.locator("#min-result-samples")).toBeEnabled();
  await page.locator("#min-result-samples").fill("5");
  await expect(rows).toHaveCount(1);
  await page.locator("#min-result-samples").fill("1");
  await expect(rows).toHaveCount(1);
  for (const locale of ["en", "ru"]) {
    await page.locator("#locale-switcher").selectOption(locale);
    await expect(reference).toHaveText(/6[\s,]?651/);
    await expect(page.locator("#result-query")).toContainText(await reference.innerText());
  }
  await page.locator("#target-year").fill("6500");
  await expect(rows).toHaveCount(0);
  await expect(page.locator("#result-query")).toContainText(await reference.innerText());
  await expect(reference).toContainText(/6\s?500/);
  expect(new URL(page.url()).searchParams.get("countries")).toBe("POL,RUS");
  await page.goto("/?lang=ru&countries=RUS,POL&presence=all&target=10000&window=0&min=5&crossing=1");
  const crossing = page.locator('#crossing-result-body tr[data-result-role="crossing"]');
  await expect(crossing).toHaveCount(1);
  await expect(crossing.locator(".table-total strong")).toHaveText("11");
  await expect(crossing.locator(".country-pill-inactive")).toContainText("POL");
  await expect(crossing.locator(".country-pill-inactive strong")).toHaveText("3");
});

test("temporal-pool minimum selects countries before finding common branches", async ({ page }) => {
  const data = compact([-1, 0, 0, 0, 0], [18000, 8600, 8600, 8600, 3000],
    [[1, 0, 8], [1, 1, 1], [2, 0, 2], [3, 1, 7], [4, 2, 100]]);
  data.countryCodes = ["RUS", "POL", "FRA"];
  data.nodeIds = ["R-SYN-ROOT", "R-SYN-COMMON", "R-SYN-RUSONLY", "R-SYN-POLONLY", "R-SYN-FRAONLY"];
  data.projectIds = ["R"];
  await page.route("**/data/hras-index.json", route => route.fulfill({ json: data }));
  await page.goto("/?lang=ru&countries=RUS,POL,FRA&presence=all&target=8600&window=0&min=5");
  const rows = page.locator('#result-body tr[data-result-role="formed"]');
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("R-SYN-COMMON");
  // Poland has 8 across the temporal pool, so its local count of 1 is active.
  await expect(rows.locator(".country-pill-inactive")).toHaveCount(0);
  await expect(rows.locator(".table-total strong")).toHaveText("9");
  await page.locator("#min-result-samples").fill("9");
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: "R-SYN-COMMON" }).locator(".country-pill-inactive")).toContainText("POL");
  await page.locator("#min-result-samples").fill("5");
  // France's 100 samples outside the temporal pool must not constrain this date.
  await expect(rows).toHaveCount(1);
  await page.locator("#max-delta-ybp").fill("6000");
  await expect(rows).toHaveCount(0);
  await page.locator("#max-delta-ybp").fill("0");
  await expect(rows).toHaveCount(1);
  await page.locator('#presence-mode-toggle [data-presence="any"]').click();
  await expect(rows).toHaveCount(3);
  await expect(rows.locator(".country-pill-inactive")).toHaveCount(0);
  await expect(page.locator("#min-result-samples")).toBeDisabled();
  await page.goto("/?lang=ru&countries=FRA&presence=all&target=3000&window=0&min=101");
  await expect(page.locator("#presence-mode-toggle")).toBeVisible();
  await expect(rows).toHaveCount(0);
  await page.locator('#presence-mode-toggle [data-presence="any"]').click();
  await expect(rows).toHaveCount(1);
  await expect(rows.locator(".table-total strong")).toHaveText("100");
});

test("below-minimum flags stay inactive in the expanded country list", async ({ page }) => {
  const countries = ["RUS", "POL", "FRA", "DEU", "ESP", "ITA", "BGR", "CHE", "AUT", "GBR", "NLD", "SWE", "NOR", "DNK", "FIN", "CZE", "BEL", "UKR"];
  const data = compact([-1, 0], [18000, 8600], countries.map((_, i) => [1, i, i === 0 ? 8 : 1]));
  data.countryCodes = countries;
  data.countryCounts = countries.map((_, i) => i === 0 ? 8 : 1);
  data.hrasManifestSampleCount = 25;
  data.nodeIds = ["R-SYN-ROOT", "R-SYN-FLAGS"];
  data.projectIds = ["R"];
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/data/hras-index.json", route => route.fulfill({ json: data }));
  await page.goto(`/?lang=ru&countries=${countries.join(",")}&presence=all&target=8600&window=0&min=5`);
  const row = page.locator('#result-body tr[data-result-role="formed"]');
  await expect(row).toHaveCount(1);
  await expect(row.locator(".country-pill")).toHaveCount(3);
  await expect(row.locator(".country-pill").first()).toContainText("RUS");
  for (const [locale, status] of [["ru", "во временной выборке"], ["en", "across the temporal candidates"],]) {
    await page.locator("#locale-switcher").selectOption(locale);
    if (!await row.locator(".chip-details").evaluate(el => (el as HTMLDetailsElement).open)) {
      await row.locator(".chip-details > summary").click();
    }
    await expect(row.locator(".country-pill")).toHaveCount(18);
    await expect(row.locator(".country-pill-inactive")).toHaveCount(17);
    await row.locator('.country-pill-inactive [data-annotation="country-minimum"]').last().click();
    await expect(page.locator("#context-annotation")).toContainText(status);
    await page.keyboard.press("Escape");
    expect(await row.locator(".country-pill-inactive .flag").first().evaluate(el => getComputedStyle(el).opacity)).toBe("0.35");
    await expect(row.locator(".table-total strong")).toHaveText("25");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.screenshot({ path: "output/snapshot-country-minimum/flags-expanded-390.png", fullPage: true });
  await page.locator("#min-result-samples").fill("1");
  await expect(row.locator(".country-pill-inactive")).toHaveCount(0);
  await expect(row.locator(".table-total strong")).toHaveText("25");
  expect(errors).toEqual([]);
});

test("header explanations and compact date-transition controls remain readable", async ({ page }) => {
  test.setTimeout(90_000);
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  const data=layoutFixture(); data.hrasManifestSampleCount=data.samples.reduce((sum,row)=>sum+row[2],0)+11;
  await page.route("**/data/hras-index.json",route=>route.fulfill({json:data}));
  await page.goto(layoutQuery); await expect(page.locator("#export-csv")).toBeEnabled();
  for(const name of ["hprovyn/hras","YFullTeam/YTree","maxkrut/ynodus"]){
    const link=page.getByRole("link",{name:"GitHub: "+name,exact:true});
    await expect(link).toHaveAttribute("href","https://github.com/"+name); await expect(link.locator("svg")).toBeVisible();
  }
  for(const width of [320,390,761,1051,1280,1440,2560]){
    await page.setViewportSize({width,height:950});
    for(const locale of ["ru","en"]){
      await page.locator("#locale-switcher").selectOption(locale); await checkSourceExplanations(page);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(0);
      const presence=page.locator("#presence-mode-toggle");
      await expect(presence.locator("[data-presence]")).toHaveCount(2);
      await expect(page.locator(".provenance-details")).toHaveCount(0);
      if(width<=760){expect((await presence.boundingBox())!.height).toBeGreaterThanOrEqual(44);expect((await page.locator(".query-binary-switch").boundingBox())!.height).toBeGreaterThanOrEqual(44);}
    }
  }
  const crossing=page.locator("#include-crossing"); await crossing.focus();await crossing.press("Space");
  await expect(crossing).toBeChecked(); await expect(page.locator(".crossing-result-set")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("crossing")).toBe("1");
  await page.locator(".query-binary-switch").click();await expect(crossing).not.toBeChecked();await expect(page.locator(".crossing-result-set")).toBeHidden();
  const presence=page.locator("#presence-mode-toggle");await presence.focus();await presence.press("Space");await expect(presence).toHaveAttribute("aria-checked","true");
  await presence.locator('[data-presence="any"]').click();await expect(presence).toHaveAttribute("aria-checked","false");
  expect(new URL(page.url()).searchParams.get("presence")).toBe("any"); expect(errors).toEqual([]);
});
