import { expect, test } from "@playwright/test";

test("small portrait and landscape keep the country methodology reachable", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/");
  await expect(page.locator("#results")).toBeVisible({ timeout: 20_000 });
  await page.locator("#locale-switcher").selectOption("ru");

  const compactResultGeometry = await page.evaluate(() => {
    const toolbar = document.querySelector<HTMLElement>(".query-parameters")!;
    const minChip = document.querySelector<HTMLElement>("#query-min-control")!;
    const minSamples = document.querySelector<HTMLElement>("#query-min-control")!;
    const row = document.querySelector<HTMLElement>("#result-body tr[data-result-role]")!;
    const cells = [...row.children].filter((cell) => {
      const rect = cell.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    const intersections: Array<{ x: number; y: number }> = [];
    for (let first = 0; first < cells.length; first += 1) {
      for (let second = first + 1; second < cells.length; second += 1) {
        const a = cells[first].getBoundingClientRect();
        const aRight = a.right - parseFloat(getComputedStyle(cells[first]).paddingRight);
        const b = cells[second].getBoundingClientRect();
        intersections.push({
          x: Math.min(aRight, b.right) - Math.max(a.left, b.left),
          y: Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top),
        });
      }
    }
    const labels = [...row.querySelectorAll<HTMLElement>(".mobile-cell-label")];
    const tableWrap = document.querySelector<HTMLElement>(".table-wrap")!;
    const minSamplesInput = document.querySelector<HTMLElement>("#min-result-samples")!;
    const toolbarBox = toolbar.getBoundingClientRect();
    const minChipBox = minChip.getBoundingClientRect();
    const minSamplesBox = minSamples.getBoundingClientRect();
    const minSamplesInputBox = minSamplesInput.getBoundingClientRect();
    return {
      minChipLeft: minChipBox.left,
      minChipWidth: minChipBox.width,
      minSamplesInputContained:
        minSamplesInputBox.left >= minSamplesBox.left - 0.5
        && minSamplesInputBox.right <= minSamplesBox.right + 0.5,
      toolbarLeft: toolbarBox.left,
      toolbarWidth: toolbarBox.width,
      intersections,
      labelsFit: labels.every((label) => label.scrollWidth <= label.clientWidth + 1),
      tableClientWidth: tableWrap.clientWidth,
      tableScrollWidth: tableWrap.scrollWidth,
    };
  });
  expect(compactResultGeometry.minChipLeft).toBeGreaterThanOrEqual(compactResultGeometry.toolbarLeft);
  expect(compactResultGeometry.minChipLeft + compactResultGeometry.minChipWidth)
    .toBeLessThanOrEqual(compactResultGeometry.toolbarLeft + compactResultGeometry.toolbarWidth + 1);
  expect(compactResultGeometry.minChipWidth)
    .toBeLessThan(compactResultGeometry.toolbarWidth * 0.75);
  expect(compactResultGeometry.minSamplesInputContained).toBeTruthy();
  expect(compactResultGeometry.intersections.every(({ x, y }) => x <= 0.5 || y <= 0.5))
    .toBeTruthy();
  expect(compactResultGeometry.labelsFit).toBeTruthy();
  expect(compactResultGeometry.tableScrollWidth)
    .toBeLessThanOrEqual(compactResultGeometry.tableClientWidth + 1);

  await page.locator("#selection-panel-toggle").click();
  await expect(page.locator("#country-search")).toBeFocused();

  const countrySearch = page.locator("#country-search");
  const russianOption = page.locator('[data-country-code="RUS"]');
  await countrySearch.fill("RUS");
  await expect(russianOption).toBeVisible();
  await countrySearch.fill("Россия");
  await expect(russianOption).toBeVisible();
  await countrySearch.fill("");
  const initiallyChecked = await russianOption.isChecked();
  await russianOption.focus();
  await russianOption.press("Space");
  expect(await russianOption.isChecked()).toBe(!initiallyChecked);
  await russianOption.press("Space");
  expect(await russianOption.isChecked()).toBe(initiallyChecked);

  const portraitGeometry = await page.locator("#selection-panel").evaluate((dialog) => {
    const note = dialog.querySelector<HTMLElement>(".picker-method-note")!;
    const content = dialog.querySelector<HTMLElement>(".mockup-inline-selection-content")!;
    const countryList = dialog.querySelector<HTMLElement>(".country-list")!;
    const presets = dialog.querySelector<HTMLElement>(".preset-panel")!;
    const noteBox = note.getBoundingClientRect();
    const contentBox = content.getBoundingClientRect();
    const search = dialog.querySelector<HTMLElement>("#country-search")!;
    const remove = dialog.querySelector<HTMLElement>(".chip-remove")!;
    const bulkAction = dialog.querySelector<HTMLElement>(".country-list-actions .small-button")!;
    const selectedCounts = [...dialog.querySelectorAll<HTMLElement>(".selected-count")]
      .filter((count) => count.getClientRects().length > 0);
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      noteBottom: noteBox.bottom,
      contentTop: contentBox.top,
      contentScrollHeight: content.scrollHeight,
      contentOverflowY: getComputedStyle(content).overflowY,
      countryListOverflowY: getComputedStyle(countryList).overflowY,
      presetOverflowY: getComputedStyle(presets).overflowY,
      searchHeight: search.getBoundingClientRect().height,
      searchFontSize: Number.parseFloat(getComputedStyle(search).fontSize),
      removeHeight: remove.getBoundingClientRect().height,
      bulkActionHeight: bulkAction.getBoundingClientRect().height,
      selectedCountsFit: selectedCounts.every((count) => count.scrollWidth <= count.clientWidth + 1),
    };
  });
  expect(portraitGeometry.documentWidth).toBeLessThanOrEqual(portraitGeometry.viewportWidth);
  expect(portraitGeometry.contentOverflowY).toBe("hidden");
  expect(portraitGeometry.countryListOverflowY).toBe("auto");
  expect(portraitGeometry.presetOverflowY).toBe("auto");
  expect(portraitGeometry.noteBottom).toBeLessThanOrEqual(
    portraitGeometry.contentTop + portraitGeometry.contentScrollHeight + 1,
  );
  expect(portraitGeometry.searchHeight).toBeGreaterThanOrEqual(44);
  expect(portraitGeometry.searchFontSize).toBeGreaterThanOrEqual(16);
  expect(portraitGeometry.removeHeight).toBeGreaterThanOrEqual(44);
  expect(portraitGeometry.bulkActionHeight).toBeGreaterThanOrEqual(44);
  expect(portraitGeometry.selectedCountsFit).toBeTruthy();

  await page.keyboard.press("Escape");
  await expect(page.locator("#tab-subclades, #subclade-selection-panel")).toHaveCount(0);
  const macroFilter = page.locator("#result-macrogroup-filter");
  await expect(macroFilter).toBeVisible();
  expect((await macroFilter.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  await page.locator("#result-body [data-open-result-detail]").first().click();
  const branchLedgerGeometry = await page.locator("#profile-content .profile-tree-section").evaluate((section) => ({
    fits: section.scrollWidth <= section.clientWidth + 1,
    groups: section.querySelectorAll("[data-tree-node]").length,
  }));
  expect(branchLedgerGeometry.fits).toBeTruthy();
  expect(branchLedgerGeometry.groups).toBeGreaterThan(0);
  await page.locator('#profile-workspace [data-research-back]').click();

  await page.setViewportSize({ width: 844, height: 390 });
  await page.locator("#selection-panel-toggle").click();
  const landscapeGeometry = await page.locator("#selection-panel").evaluate((dialog) => {
    const content = dialog.querySelector<HTMLElement>(".mockup-inline-selection-content")!;
    const note = dialog.querySelector<HTMLElement>(".picker-method-note")!;
    const countryList = dialog.querySelector<HTMLElement>(".country-list")!;
    const presets = dialog.querySelector<HTMLElement>(".preset-panel")!;
    const contentBox = content.getBoundingClientRect();
    const noteBox = note.getBoundingClientRect();
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      overflowY: getComputedStyle(content).overflowY,
      countryListOverflowY: getComputedStyle(countryList).overflowY,
      presetOverflowY: getComputedStyle(presets).overflowY,
      contentTop: contentBox.top,
      contentScrollHeight: content.scrollHeight,
      noteBottom: noteBox.bottom,
    };
  });
  expect(landscapeGeometry.documentWidth).toBeLessThanOrEqual(landscapeGeometry.viewportWidth);
  expect(landscapeGeometry.overflowY).toBe("hidden");
  expect(landscapeGeometry.countryListOverflowY).toBe("auto");
  expect(landscapeGeometry.presetOverflowY).toBe("auto");
  expect(landscapeGeometry.noteBottom).toBeLessThanOrEqual(
    landscapeGeometry.contentTop + landscapeGeometry.contentScrollHeight + 1,
  );
});
