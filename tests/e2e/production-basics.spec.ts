import { populatedTimeUrl } from "../fixtures/time-url";
import { expect, test } from "@playwright/test";
import { branchCountriesLargeFixture } from "../fixtures/branch-countries.mjs";
import { layoutFixture } from "../fixtures/layout.mjs";
import {
  focusDialogBoundary,
  setCrossingEnabled,
} from "./production-smoke-support";

test("production publishes real legal and source-ledger documents", async ({ request }) => {
  const license = await request.get("/legal/LICENSE.txt");
  expect(license.ok()).toBeTruthy();
  expect(license.headers()["content-type"]).toContain("text/plain");
  await expect(license.text()).resolves.toContain("Apache License\nVersion 2.0");

  const notice = await request.get("/legal/NOTICE.txt");
  expect(notice.ok()).toBeTruthy();
  expect(notice.headers()["content-type"]).toContain("text/plain");
  const noticeText = await notice.text();
  expect(noticeText).toContain("## Generated Data Index");
  expect(noticeText).toContain("is not relicensed as Apache-2.0");
});

test("390px keeps matches readable and the timeline inside the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(populatedTimeUrl);
  await expect(page.locator("#results")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("#result-body tr[data-result-role]").first()).toBeVisible();
  const timeEntrypoint = page.locator('.research-entrypoints [data-research-view="time"]');
  const profileEntrypoint = page.locator('.research-entrypoints [data-research-view="profile"]');
  const entrypointGeometry = await Promise.all([
    timeEntrypoint.boundingBox(),
    profileEntrypoint.boundingBox(),
  ]);
  expect(entrypointGeometry[0]?.height).toBeLessThanOrEqual(50);
  expect(entrypointGeometry[1]?.x).toBeGreaterThanOrEqual(
    (entrypointGeometry[0]?.x ?? 0) + (entrypointGeometry[0]?.width ?? 0),
  );
  expect(
    (entrypointGeometry[1]?.x ?? 0) + (entrypointGeometry[1]?.width ?? 0),
  ).toBeLessThanOrEqual(390);
  const firstMobileRowLabels = page.locator(
    "#result-body tr[data-result-role]",
  ).first().locator(".mobile-cell-label");
  await expect(firstMobileRowLabels).toHaveCount(5);
  for (const label of (await firstMobileRowLabels.all()).slice(1, 4)) {
    await expect(label).toBeVisible();
  }
  const firstMobileCountries = page.locator(
    "#result-body tr[data-result-role]",
  ).first().locator(".country-pills-mobile");
  await expect(firstMobileCountries).toBeVisible();
  await expect(firstMobileCountries.locator(".country-pill")).toHaveCount(3);
  const mobileCountryDisclosure = firstMobileCountries.locator(".chip-details summary");
  await expect(mobileCountryDisclosure).toBeVisible();
  expect((await mobileCountryDisclosure.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await mobileCountryDisclosure.click();
  const mobileCountryPopover = firstMobileCountries.locator(".chip-popover");
  await expect(mobileCountryPopover.locator(".country-pill")).toHaveCount(10);
  const mobileCountryPopoverBox = await mobileCountryPopover.boundingBox();
  expect(mobileCountryPopoverBox?.x).toBeGreaterThanOrEqual(0);
  expect(
    (mobileCountryPopoverBox?.x ?? 0) + (mobileCountryPopoverBox?.width ?? 0),
  ).toBeLessThanOrEqual(390);
  await mobileCountryDisclosure.click();

  const layout = await page.evaluate(() => {
    const results = document.querySelector<HTMLElement>(".results-zone")!;
    const timeline = document.querySelector<HTMLElement>(".timeline-zone")!;
    const axis = document.querySelector<HTMLElement>(".time-axis")!;
    const axisRect = axis.getBoundingClientRect();
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      resultsTop: results.getBoundingClientRect().top,
      timelineTop: timeline.getBoundingClientRect().top,
      axisLeft: axisRect.left,
      axisRight: axisRect.right,
      bucketCount: document.querySelectorAll("#target-density > button").length,
      minimumBucketWidth: Math.min(
        ...[...document.querySelectorAll<HTMLElement>("#target-density > button")]
          .map((button) => button.getBoundingClientRect().width),
      ),
    };
  });
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.resultsTop).toBeGreaterThan(layout.timelineTop);
  expect(layout.resultsTop).toBeLessThan(844);
  expect(layout.axisLeft).toBeGreaterThanOrEqual(0);
  expect(layout.axisRight).toBeLessThanOrEqual(390);
  expect(layout.bucketCount).toBeGreaterThan(0);
  expect(layout.minimumBucketWidth).toBeGreaterThan(0);
  await expect(page.locator(".axis-ce > span").first()).toHaveText("1950");

  const targetValue = await page.locator("#target-year").inputValue();
  const rowCount = await page.locator("#result-body tr[data-result-role]").count();
  const selectedCountryCount = await page.locator("#stat-selected").textContent();
  const firstResultIdentity = await page.locator(
    "#result-body tr[data-result-role] .mockup-subclade-main .subclade-link",
  ).first().textContent();
  const firstResultSupport = await page.locator(
    "#result-body tr[data-result-role] .mockup-support strong",
  ).first().evaluate((value) => Number(value.textContent?.replace(/[^0-9]/g, "")));
  const mobileFormFontSizes = await page.evaluate(() => (
    [...document.querySelectorAll<HTMLElement>(
      "#locale-switcher, #target-year, #max-delta-ybp, #min-result-samples",
    )].map((control) => Number.parseFloat(getComputedStyle(control).fontSize))
  ));
  expect(Math.min(...mobileFormFontSizes)).toBeGreaterThanOrEqual(16);
  expect(await page.locator("#target-era").evaluate((control) => (
    Number.parseFloat(getComputedStyle(control).fontSize)
  ))).toBeGreaterThanOrEqual(11);
  expect((await page.locator("#target-era").boundingBox())?.width).toBeGreaterThanOrEqual(72);
  // Firefox can report a 44px CSS target as 43.999992px after layout rounding.
  expect((await page.locator("#export-csv").boundingBox())?.height).toBeGreaterThanOrEqual(43.99);
  expect((await page.locator('.formed-result-set [data-annotation="formed"]').boundingBox())?.height)
    .toBeGreaterThanOrEqual(32);
  const eraLabels: Record<string, string[]> = {
    en: ["BCE", "CE"],
    ru: ["до н. э.", "н. э."],
  };
  const entrypointLabels: Record<string, string> = {
    en: "Countries in sample records & time",
    ru: "Страны образцов и время",
  };
  for (const locale of ["ru", "en"]) {
    await page.locator("#locale-switcher").selectOption(locale);
    await expect(timeEntrypoint).toContainText(entrypointLabels[locale]);
    const [timeBox, profileBox] = await Promise.all([
      timeEntrypoint.boundingBox(),
      profileEntrypoint.boundingBox(),
    ]);
    expect(timeBox?.height).toBeLessThanOrEqual(50);
    expect(profileBox?.x).toBeGreaterThanOrEqual((timeBox?.x ?? 0) + (timeBox?.width ?? 0));
    expect((profileBox?.x ?? 0) + (profileBox?.width ?? 0)).toBeLessThanOrEqual(390);
    await expect(page.locator("#target-year")).toHaveValue(targetValue);
    await expect(page.locator("#result-body tr[data-result-role]")).toHaveCount(rowCount);
    await expect(page.locator("#stat-selected")).toHaveText(selectedCountryCount ?? "");
    await expect(page.locator(
      "#result-body tr[data-result-role] .mockup-subclade-main .subclade-link",
    ).first()).toHaveText(firstResultIdentity ?? "");
    expect(await page.locator(
      "#result-body tr[data-result-role] .mockup-support strong",
    ).first().evaluate((value) => Number(value.textContent?.replace(/[^0-9]/g, ""))))
      .toBe(firstResultSupport);
    await expect(page.locator("#target-era .query-switch-option")).toHaveText(eraLabels[locale]);
    await expect(page.locator(".app-header .provenance-date time")).toHaveCount(3);
    for (const sourceDate of await page.locator(".app-header .provenance-date time").all()) {
      await expect(sourceDate).toBeVisible();
      await expect(sourceDate).not.toHaveText("");
    }
    await expect(page.locator(".provenance-links").first()).toBeVisible();
    const sourceTargets = await page.locator(".app-header .provenance-rail a").evaluateAll(
      (links) => links.map((link) => {
        const rect = link.getBoundingClientRect();
        return {
          href: link.href,
          width: rect.width,
          height: rect.height,
          fontSize: Number.parseFloat(getComputedStyle(link).fontSize),
        };
      }),
    );
    expect(sourceTargets.length).toBeGreaterThan(0);
    for (const target of sourceTargets) {
      expect(target.width).toBeGreaterThanOrEqual(24);
      expect(target.height).toBeGreaterThanOrEqual(24);
      expect(target.fontSize).toBeGreaterThanOrEqual(9);
    }
    for (const requiredTarget of [
      "hras.yseq.net/",
      "hras.yseq.net/data/manifest",
      "github.com/hprovyn/hras",
      "raw.githubusercontent.com/YFullTeam/YTree",
      "yfull.com/tree/",
      "github.com/YFullTeam/YTree",
      "/data/hras-index.json",
      "/legal/NOTICE.txt",
      "/legal/LICENSE.txt",
    ]) {
      expect(sourceTargets.some(({ href }) => href.includes(requiredTarget))).toBeTruthy();
    }
  }

  const resultHelpTrigger = page.locator('.formed-result-set [data-annotation="formed"]');
  await resultHelpTrigger.click();
  const methodologyBox = await page.locator("#context-annotation").boundingBox();
  expect(methodologyBox?.x).toBeGreaterThanOrEqual(0);
  expect((methodologyBox?.x ?? 0) + (methodologyBox?.width ?? 0)).toBeLessThanOrEqual(390);
  await page.keyboard.press("Escape");
  await expect(page.locator("#context-annotation")).toBeHidden();
  await expect(resultHelpTrigger).toBeFocused();
});

test("Formed stays primary while optional Crossing uses its own table and sort state", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const data = layoutFixture();
  data.nodes[data.nodeIds.indexOf("R-SYN-200")][2] = 5500;
  await page.route("**/data/hras-index.json", route => route.fulfill({ json: data }));
  await page.goto(`/?lang=ru&countries=${data.countryCodes.join(",")}&presence=any&min=0&target=5500&window=100`);
  await expect(page.locator("#results")).toBeVisible({ timeout: 20_000 });

  const supportValues = await page.locator("#result-body tr[data-result-role] .mockup-support strong")
    .evaluateAll((values) => values.map((value) => Number(value.textContent?.replace(/[^0-9]/g, ""))));
  expect(supportValues).toEqual([...supportValues].sort((left, right) => right - left));

  const countryDisclosure = page.locator(".country-pills-desktop .chip-details:visible").first();
  const countryDisclosureTrigger = countryDisclosure.locator("summary");
  await countryDisclosureTrigger.click();
  await expect(countryDisclosure.locator(".chip-popover .country-pill").first()).toBeVisible();
  await countryDisclosureTrigger.click();
  await expect(countryDisclosure).not.toHaveAttribute("open", "");

  const branchRow = page.locator(".formed-branch-result-row").filter({ has: page.locator('[data-open-result-detail="R-SYN-100"]') });
  await expect(branchRow.locator("[data-result-composition]")).toHaveAttribute("data-tooltip", /R-SYN-100 и ещё 1 субклад ниже по дереву. Всего субкладов: 2/);
  const branchTotal = await branchRow.locator(".mockup-support strong").innerText();
  await expect(page.locator(".formed-branch-dialog")).toHaveCount(0);
  await branchRow.locator("[data-open-result-detail]").click();
  await expect(page.locator('#profile-content [data-tree-node="R-SYN-100"] [data-branch-tree-all]')).toHaveText(branchTotal);
  await expect(page.locator('#profile-content [data-tree-node="R-SYN-200"]')).toBeVisible();
  await expect(page.locator("#profile-lookup")).toBeHidden();
  await page.locator('#profile-workspace [data-research-back]').click();

  await page.locator('[data-table-sort="delta"]').click();
  const formedIds = await page.locator('#result-body tr[data-result-role="formed"] [data-open-result-detail]')
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("data-open-result-detail")));
  await setCrossingEnabled(page, true);
  const crossingRow = page.locator('#crossing-result-body tr[data-result-role="crossing"]').first();
  await expect(crossingRow).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("#results")).toBeVisible();
  await expect(page.locator("#result-query")).toContainText("±");
  await expect(page.locator("#crossing-result-title")).not.toContainText("±");
  expect(await page.locator('#result-body tr[data-result-role="formed"] [data-open-result-detail]')
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("data-open-result-detail"))))
    .toEqual(formedIds);
  await expect(page.locator('#crossing-result-head [data-table-sort="delta"]')).toHaveCount(0);
  await expect(page.locator('#crossing-result-head [data-table-sort="total"]')).toHaveClass(/active/);
  await expect(page.locator('#crossing-result-head [data-table-sort="total"]').locator(".."))
    .toHaveAttribute("aria-sort", "descending");
  expect(await page.locator("#crossing-result-head th").count()).toBe(6);
  expect(await crossingRow.locator("td").count()).toBe(6);
  const crossingGeometry = await crossingRow.evaluate((row) => {
    const cells = row.querySelectorAll<HTMLElement>("td");
    return {
      rowHeight: row.getBoundingClientRect().height,
      countriesWidth: cells[4]?.getBoundingClientRect().width ?? 0,
    };
  });
  expect(crossingGeometry.rowHeight).toBeLessThan(100);
  expect(crossingGeometry.countriesWidth).toBeGreaterThan(250);
  await setCrossingEnabled(page, false);
  await expect(page.locator("#crossing-results-section")).toBeHidden();
  await expect(page.locator("#results")).toBeVisible();
});

test("country picker contains keyboard focus and restores its opener", async ({ page }) => {
  await page.goto(populatedTimeUrl);
  const countryOpener = page.locator("#selection-panel-toggle");
  await countryOpener.click();
  const countryDialog = page.locator("#selection-panel");
  const countryLast = await focusDialogBoundary(countryDialog, "last");
  await page.keyboard.press("Tab");
  const countryFirst = countryDialog.locator("[data-e2e-focus-first]");
  await expect(countryFirst).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(countryLast).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(countryDialog).not.toBeVisible();
  await expect(countryOpener).toBeFocused();
});

test("locale changes preserve a failed-load Retry action", async ({ page }) => {
  await page.route("**/data/hras-index.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>fallback</title>",
    });
  });
  await page.goto(populatedTimeUrl);
  await expect(page.locator("[data-retry-load]")).toBeVisible();
  await expect(page.locator("#empty-state")).toHaveAttribute("role", "alert");
  await page.locator("#locale-switcher").selectOption("en");
  await expect(page.locator("[data-retry-load]")).toBeVisible();
  await expect(page.locator(".empty-title")).toHaveText("The data address returned a web page instead of the yNodus dataset.");
  const diagnostics = page.locator(".error-diagnostics");
  await expect(diagnostics.locator("summary")).toHaveText("Technical details");
  await expect(diagnostics.locator("code")).not.toBeVisible();
  expect(await diagnostics.locator("code").textContent()).toContain("HTML");
  await diagnostics.locator("summary").click();
  await expect(diagnostics.locator("code")).toBeVisible();
});

test("country matrix expansion preserves language, filtering and profile return", async ({ page }) => {
  await page.route("**/data/hras-index.json", route => route.fulfill({ json: branchCountriesLargeFixture() }));
  await page.goto("/?lang=ru&view=profile&clade=R-SYN-ROOT");
  await expect(page.locator("#profile-content h3").first()).toHaveText("R-SYN-ROOT");
  await page.locator('#profile-content [data-tree-node="R-SYN-ROOT"] [data-country-evidence="RUS"]').click();
  const country = page.locator("#country-evidence-workspace");
  const nodes = country.locator("[data-tree-node]");
  await expect(nodes).toHaveCount(2);
  await expect(country.locator('[data-tree-node="R-SYN-ZERO-0"]')).toHaveCount(0);
  await country.locator('[data-tree-country-reset]').click();
  await expect(nodes).toHaveCount(21);
  await country.locator('[data-evidence-tree-more="R-SYN-ROOT"]').click();
  await expect(nodes).toHaveCount(41);
  await page.locator("#locale-switcher").selectOption("en");
  await expect(nodes).toHaveCount(41);
  await page.locator('[data-branch-tree-search]').fill("R-SYN-ZERO-59");
  await expect(country.locator('[data-tree-node="R-SYN-ZERO-59"]')).toBeVisible();
  await page.locator('#country-evidence-workspace [data-research-back]').click();
  await expect(page.locator("#profile-content h3").first()).toHaveText("R-SYN-ROOT");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("tablet keeps locale, source ledger and country picker within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto(populatedTimeUrl);
  await expect(page.locator("#results")).toBeVisible({ timeout: 20_000 });
  for (const locale of ["en", "ru",]) {
    await page.locator("#locale-switcher").selectOption(locale);
    const widths = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client);
  }

  await page.locator("#selection-panel-toggle").click();
  const picker = page.locator("#selection-panel");
  await expect(picker).toBeVisible();
  const box = await picker.boundingBox();
  expect(box?.x).toBeGreaterThanOrEqual(0);
  expect(box?.y).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(768);
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(900);

  const pickerGeometry = await picker.evaluate((dialog) => {
    const pane = dialog.querySelector<HTMLElement>(".mockup-selection-pane")!;
    const note = dialog.querySelector<HTMLElement>(".picker-method-note")!;
    const option = dialog.querySelector<HTMLElement>(".country-option")!;
    const flag = option.querySelector<HTMLElement>(".flag")!;
    const preset = dialog.querySelector<HTMLElement>(".preset-option-button")!;
    const paneBox = pane.getBoundingClientRect();
    const noteBox = note.getBoundingClientRect();
    const optionBox = option.getBoundingClientRect();
    const flagBox = flag.getBoundingClientRect();
    return {
      paneClientWidth: pane.clientWidth,
      paneScrollWidth: pane.scrollWidth,
      noteBottom: noteBox.bottom,
      paneBottom: paneBox.bottom,
      optionHeight: optionBox.height,
      flagWidth: flagBox.width,
      flagHeight: flagBox.height,
      presetVisible: preset.getBoundingClientRect().top < window.innerHeight,
    };
  });
  expect(pickerGeometry.paneScrollWidth).toBeLessThanOrEqual(pickerGeometry.paneClientWidth);
  expect(pickerGeometry.noteBottom).toBeLessThanOrEqual(pickerGeometry.paneBottom + 1);
  expect(pickerGeometry.optionHeight).toBeGreaterThanOrEqual(44);
  expect(pickerGeometry.flagWidth).toBeLessThanOrEqual(22);
  expect(pickerGeometry.flagHeight).toBeLessThanOrEqual(15);
  expect(pickerGeometry.presetVisible).toBeTruthy();

  await page.keyboard.press("Escape");
  await expect(picker).not.toBeVisible();
  await expect(page.locator("#selection-panel-toggle")).toBeFocused();
});
