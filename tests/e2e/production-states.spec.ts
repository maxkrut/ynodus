import { populatedTimeUrl } from "../fixtures/time-url";
import { expect, test } from "@playwright/test";
import {
  fillMinResultSamples,
} from "./production-smoke-support";

test("mobile empty and load-error states keep recovery actions readable and tappable", async ({ page }) => {
  await page.setViewportSize({ width: 340, height: 844 });
  await page.goto(populatedTimeUrl);
  await expect(page.locator("#results")).toBeVisible({ timeout: 20_000 });
  await page.locator("#locale-switcher").selectOption("ru");
  await fillMinResultSamples(page, "100000");

  const noResultRow = page.locator("#result-body .no-result-row");
  await expect(noResultRow).toBeVisible({ timeout: 20_000 });
  const noResultGeometry = await noResultRow.evaluate((row) => {
    const actions = [...row.querySelectorAll<HTMLElement>(".no-result-actions .small-button")];
    const actionBoxes = actions.map((action) => action.getBoundingClientRect());
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      minimumActionHeight: Math.min(...actionBoxes.map((box) => box.height)),
      actionsFit: actions.every((action) => action.scrollWidth <= action.clientWidth + 1),
      actionsInsideViewport: actionBoxes.every((box) => box.left >= 0 && box.right <= innerWidth),
    };
  });
  expect(noResultGeometry.documentWidth).toBeLessThanOrEqual(noResultGeometry.viewportWidth);
  expect(noResultGeometry.minimumActionHeight).toBeGreaterThanOrEqual(44);
  expect(noResultGeometry.actionsFit).toBeTruthy();
  expect(noResultGeometry.actionsInsideViewport).toBeTruthy();

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await page.route("**/data/hras-index.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>fallback</title>",
    });
  });
  await page.goto(populatedTimeUrl);
  await page.locator("#locale-switcher").selectOption("ru");
  const retry = page.locator("[data-retry-load]");
  await expect(retry).toBeVisible();
  const retryBox = await retry.boundingBox();
  expect(retryBox?.height).toBeGreaterThanOrEqual(44);
  const diagnostics = page.locator(".error-diagnostics");
  await diagnostics.locator("summary").click();
  const errorGeometry = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    diagnosticsFit: [...document.querySelectorAll<HTMLElement>(".error-diagnostics code")]
      .every((code) => code.scrollWidth <= code.clientWidth + 1),
  }));
  expect(errorGeometry.documentWidth).toBeLessThanOrEqual(errorGeometry.viewportWidth);
  expect(errorGeometry.diagnosticsFit).toBeTruthy();
});

test("populated subclade profiles remain readable at compact and boundary widths", async ({ page }) => {
  test.setTimeout(90_000);

  for (const width of [340, 390, 640, 760, 761, 981]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(populatedTimeUrl);
    await expect(page.locator("#results")).toBeVisible({ timeout: 20_000 });
    await page.locator("#locale-switcher").selectOption("ru");
    await page.locator('.research-entrypoints [data-research-view="profile"]').click();
    await page.locator("#profile-clade-search").fill("R-Z645");
    await page.locator('#profile-lookup button[type="submit"]').click();
    await expect(page.locator("#profile-content h3").first()).toContainText("R-Z645", { timeout: 20_000 });

    const profileGeometry = await page.evaluate(() => {
      const visible = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };
      const touchTargets = [...document.querySelectorAll<HTMLElement>(
        ".profile-compact-controls button:not(.annotation-trigger), .profile-compact-controls select, .profile-compact-controls input",
      )].filter(visible);
      const identity = document.querySelector<HTMLElement>(".profile-compact-header")!;
      const identityTitle = identity.querySelector<HTMLElement>("h3")!;
      const content = document.querySelector<HTMLElement>("#profile-content")!;
      const contentBox = content.getBoundingClientRect();
      const contentChildren = [...content.children].filter((element): element is HTMLElement => (
        element instanceof HTMLElement && visible(element)
      ));
      const identityChildren = [...identity.children].filter((element): element is HTMLElement => (
        element instanceof HTMLElement && visible(element)
      ));
      const identityOverlaps: number[] = [];
      for (let first = 0; first < identityChildren.length; first += 1) {
        for (let second = first + 1; second < identityChildren.length; second += 1) {
          const a = identityChildren[first].getBoundingClientRect();
          const b = identityChildren[second].getBoundingClientRect();
          const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (x > .5 && y > .5) identityOverlaps.push(x * y);
        }
      }
      return {
        innerWidth: window.innerWidth,
        compactMedia: matchMedia("(max-width: 640px)").matches,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        contentScrollWidth: content.scrollWidth,
        contentClientWidth: content.clientWidth,
        contentChildrenOutside: contentChildren
          .map((element) => ({ className: element.className, box: element.getBoundingClientRect() }))
          .filter(({ box }) => box.left < contentBox.left - 1 || box.right > contentBox.right + 1)
          .map(({ className }) => className),
        identityOverlaps,
        identityTitleFits: identityTitle.scrollWidth <= identityTitle.clientWidth + 1,
        touchTargets: touchTargets.map((target) => ({
          label: target.getAttribute("aria-label") ?? target.textContent?.trim().slice(0, 60) ?? target.className,
          className: target.className,
          height: target.getBoundingClientRect().height,
          minHeight: getComputedStyle(target).minHeight,
        })),
        actionTextFits: [...document.querySelectorAll<HTMLElement>(
          ".profile-actions button, .evidence-reveal-button",
        )].filter(visible).every((button) => button.scrollWidth <= button.clientWidth + 1),
      };
    });

    expect(profileGeometry.documentWidth, `profile overflow at ${width}px`)
      .toBeLessThanOrEqual(profileGeometry.viewportWidth);
    expect(profileGeometry.contentScrollWidth, `profile content overflow at ${width}px`)
      .toBeLessThanOrEqual(profileGeometry.contentClientWidth + 1);
    expect(profileGeometry.contentChildrenOutside, `profile sections clipped at ${width}px`).toEqual([]);
    expect(profileGeometry.identityOverlaps, `profile identity collision at ${width}px`).toEqual([]);
    expect(profileGeometry.identityTitleFits, `profile identity wrapping at ${width}px`).toBeTruthy();
    expect(profileGeometry.actionTextFits, `profile action clipping at ${width}px`).toBeTruthy();
    if (width <= 640) {
      expect(
        profileGeometry.touchTargets.filter((target) => target.height < 44),
        `profile touch target at ${width}px; inner=${profileGeometry.innerWidth}; media=${profileGeometry.compactMedia}`,
      ).toEqual([]);
    }

    const russia = page.locator('#profile-content [data-tree-node="R-Z645"] [data-country-evidence="RUS"]');
    await expect(russia).toBeVisible();
    await russia.click();
    await expect(page.locator("#country-evidence-content .country-evidence-identity")).toContainText("RUS");
    const evidenceWidth = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(evidenceWidth.document, `country-evidence overflow at ${width}px`)
      .toBeLessThanOrEqual(evidenceWidth.viewport);
  }
});

test("large country selections stay compact, aligned and operable across picker breakpoints", async ({ page }) => {
  test.setTimeout(90_000);

  for (const width of [340, 760, 761, 981]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(populatedTimeUrl);
    await expect(page.locator("#results")).toBeVisible({ timeout: 20_000 });
    await page.locator("#locale-switcher").selectOption("ru");
    await page.locator("#selection-panel-toggle").click();
    const picker = page.locator("#selection-panel");
    await expect(picker).toBeVisible();
    await picker.locator('[data-country-action="all"]').click();

    const selectedMore = picker.locator(".selected-more");
    await expect(selectedMore).toBeVisible();
    const collapsedPreview = picker.locator("#selected-summary > .selected-chips-row > .selected-chips > .selected-chip");
    expect(await collapsedPreview.count()).toBeGreaterThan(0);
    if (width >= 1440) expect(await collapsedPreview.count()).toBeGreaterThan(3);

    const summary = selectedMore.locator("summary");
    const collapsedBox = await summary.boundingBox();
    if (width <= 760) expect(collapsedBox?.height).toBeGreaterThanOrEqual(44);
    await summary.click();
    await expect(selectedMore).toHaveAttribute("open", "");

    const pickerGeometry = await picker.evaluate((dialog) => {
      const visible = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };
      const centerSpread = (elements: HTMLElement[]) => {
        const centers = elements.filter(visible).map((element) => {
          const rect = element.getBoundingClientRect();
          return rect.top + rect.height / 2;
        });
        return centers.length > 1 ? Math.max(...centers) - Math.min(...centers) : 0;
      };
      const dialogBox = dialog.getBoundingClientRect();
      const close = dialog.querySelector<HTMLElement>("#selection-panel-close")!;
      const title = dialog.querySelector<HTMLElement>("#selection-panel-title")!;
      const titleBox = title.getBoundingClientRect();
      const closeBox = close.getBoundingClientRect();
      const previewChips = [...dialog.querySelectorAll<HTMLElement>(
        "#selected-summary > .selected-chips-row > .selected-chips > .selected-chip",
      )];
      const option = dialog.querySelector<HTMLElement>(".country-option")!;
      const optionFlag = option.querySelector<HTMLElement>(".flag")!;
      const selectedSummary = dialog.querySelector<HTMLElement>("#selected-summary")!;
      const selectedMore = dialog.querySelector<HTMLElement>(".selected-more")!;
      const popover = selectedMore.querySelector<HTMLElement>(".chip-popover")!;
      const presetButton = dialog.querySelector<HTMLElement>(".preset-option-button")!;
      const bulkActions = [...dialog.querySelectorAll<HTMLElement>(".country-list-actions .small-button")];
      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        leftInset: dialogBox.left,
        rightInset: innerWidth - dialogBox.right,
        titleCloseGap: closeBox.left - titleBox.right,
        closeHeight: closeBox.height,
        selectedSummaryClientWidth: selectedSummary.clientWidth,
        selectedSummaryScrollWidth: selectedSummary.scrollWidth,
        popoverRight: popover.getBoundingClientRect().right,
        popoverLeft: popover.getBoundingClientRect().left,
        chipCenterSpreads: previewChips.map((chip) => centerSpread([...chip.children] as HTMLElement[])),
        chipTextFits: [...dialog.querySelectorAll<HTMLElement>(".selected-code, .selected-count")]
          .filter(visible).every((item) => item.scrollWidth <= item.clientWidth + 1),
        optionCenterSpread: centerSpread([...option.children] as HTMLElement[]),
        flagWidth: optionFlag.getBoundingClientRect().width,
        flagHeight: optionFlag.getBoundingClientRect().height,
        bulkActionHeights: bulkActions.map((action) => action.getBoundingClientRect().height),
        presetTextFits: presetButton.scrollWidth <= presetButton.clientWidth + 1,
      };
    });

    expect(pickerGeometry.documentWidth, `page overflow with all countries at ${width}px`)
      .toBeLessThanOrEqual(pickerGeometry.viewportWidth);
    expect(Math.abs(pickerGeometry.leftInset - pickerGeometry.rightInset), `picker centering at ${width}px`)
      .toBeLessThanOrEqual(2);
    expect(pickerGeometry.titleCloseGap, `picker title/close gap at ${width}px`).toBeGreaterThanOrEqual(7);
    if (width <= 760) expect(pickerGeometry.closeHeight).toBeGreaterThanOrEqual(44);
    expect(pickerGeometry.selectedSummaryScrollWidth, `selected summary overflow at ${width}px`)
      .toBeLessThanOrEqual(pickerGeometry.selectedSummaryClientWidth + 1);
    expect(pickerGeometry.popoverLeft, `expanded selection left edge at ${width}px`).toBeGreaterThanOrEqual(0);
    expect(pickerGeometry.popoverRight, `expanded selection right edge at ${width}px`).toBeLessThanOrEqual(width);
    expect(Math.max(...pickerGeometry.chipCenterSpreads), `selected-chip vertical drift at ${width}px`)
      .toBeLessThanOrEqual(1);
    expect(pickerGeometry.chipTextFits, `selected-chip clipping at ${width}px`).toBeTruthy();
    expect(pickerGeometry.optionCenterSpread, `country-option vertical drift at ${width}px`)
      .toBeLessThanOrEqual(1);
    expect(pickerGeometry.flagWidth).toBeLessThanOrEqual(22);
    expect(pickerGeometry.flagHeight).toBeLessThanOrEqual(15);
    expect(pickerGeometry.presetTextFits, `preset clipping at ${width}px`).toBeTruthy();
    if (width <= 760) {
      expect(Math.min(...pickerGeometry.bulkActionHeights), `bulk-action touch target at ${width}px`)
        .toBeGreaterThanOrEqual(44);
    }

    await page.keyboard.press("Escape");
    await expect(page.locator("#selection-panel-toggle")).toBeFocused();
  }
});
