import { populatedTimeUrl } from "../fixtures/time-url";
import { openStandaloneProfile } from "./production-smoke-support";
import { expect, test, type Page, type Locator } from "@playwright/test";

async function ready(page: Page) {
  await page.goto(populatedTimeUrl);
  await expect(page.locator("#result-body tr[data-result-role]").first()).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => document.fonts.ready);
}

async function center(locator: Locator) {
  const rect = (await locator.boundingBox())!;
  return rect.y + rect.height / 2;
}

test("BR-201: brand block shares the language row axis across header breakpoints", async ({ page }) => {
  await ready(page);
  for (const width of [320, 390, 760, 761, 768, 980, 981, 1050, 1051, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const locale of ["ru", "en",]) {
      await page.locator("#locale-switcher").selectOption(locale);
      expect(
        Math.abs(await center(page.locator(".title-block")) - await center(page.locator(".header-utilities"))),
        `${width}px ${locale}`,
      ).toBeLessThan(1);
    }
  }
});

test("BR-204: tablet table headings share the data column inset", async ({ page }) => {
  await ready(page);
  await page.locator("#include-crossing").check();
  await expect(page.locator('#crossing-result-body tr[data-result-role]').first()).toBeVisible();
  for (const width of [761, 980, 1050, 1051, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const locale of ["ru", "en",]) {
      await page.locator("#locale-switcher").selectOption(locale);
      const deltas = await page.locator(".table-wrap table").evaluateAll((tables) => tables.flatMap((table) => {
        const cells = [...table.querySelectorAll("tbody tr[data-result-role]:first-child > td")];
        return [...table.querySelectorAll("thead th")].slice(0, 5).map((th, index) => {
          const td = cells[index];
          const contentLeft = (node: Element) => node.getBoundingClientRect().left + parseFloat(getComputedStyle(node).paddingLeft);
          return Math.abs(contentLeft(th) - contentLeft(td));
        });
      }));
      expect(deltas.length).toBe(10);
      expect(Math.max(...deltas)).toBeLessThan(1);
    }
  }
});

test("BR-206: profile and country metrics fit their summaries after translation", async ({ page }) => {
  test.setTimeout(60_000);
  await ready(page);
  await openStandaloneProfile(page, "R-Z645");
  await expect(page.locator("#profile-content h3").first()).toHaveText("R-Z645");
  for (const workspace of ["#profile-content", "#country-evidence-content"]) {
    if (workspace.includes("country")) await page.locator('#profile-content [data-tree-node="R-Z645"] [data-country-evidence="RUS"]').click();
    for (const width of [320, 390, 760, 761, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const locale of ["ru", "en",]) {
        await page.locator("#locale-switcher").selectOption(locale);
        const drawer = page.locator(".branch-country-filter-drawer");
        if (workspace.includes("country") && !await drawer.evaluate(el => (el as HTMLDetailsElement).open)) await drawer.locator(":scope > summary").click();
        const metrics = await page.locator(workspace.includes("country") ? `${workspace} [data-branch-scope-all], ${workspace} [data-branch-scope-selected]` : `${workspace} [data-profile-scope-total]`).evaluateAll((nodes) => nodes.map((node) => {
          const box = node.getBoundingClientRect(), article = (node.closest("article") ?? node.closest(".profile-compact-total"))!.getBoundingClientRect();
          return {visible:box.width > 0 && box.height > 0, fits:box.left >= article.left-1 && box.right <= article.right+1 && box.bottom <= article.bottom+1};
        }));
        // The profile has one scope total; branch-country comparison has all/selected totals.
        expect(metrics.length).toBe(workspace.includes("country") ? 2 : 1);
        expect(metrics.every(metric => metric.visible && metric.fits)).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
    }
  }
});

test("BR-207: the country flag aligns with its name, not adjacent branch metadata", async ({ page }) => {
  await ready(page);
  await openStandaloneProfile(page, "R-Z645");
  await expect(page.locator("#profile-content h3").first()).toHaveText("R-Z645");
  await page.locator('#profile-content [data-tree-node="R-Z645"] [data-country-evidence="RUS"]').click();
  await expect(page.locator("#country-evidence-workspace")).toBeVisible();
  for (const width of [320, 390, 761, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const locale of ["ru", "en",]) {
      await page.locator("#locale-switcher").selectOption(locale);
      expect(Math.abs(await center(page.locator(".country-evidence-flag .fi")) - await center(page.locator(".country-evidence-identity h3")))) .toBeLessThan(1);
    }
  }
});

test("BR-211: country codes share the vertical center of their flags", async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await ready(page);
    for (const locale of ["ru", "en",]) {
      await page.locator("#locale-switcher").selectOption(locale);
      const pill = page.locator("#result-body .country-pill").first();
      expect(Math.abs(await center(pill.locator(".fi")) - await center(pill.locator(":scope > .country-code")))).toBeLessThan(1);

      await page.locator("#selection-panel-toggle").click();
      const option = page.locator("#selection-panel .country-option").first();
      expect(Math.abs(await center(option.locator(".fi")) - await center(option.locator(".country-code")))).toBeLessThan(1);
      await page.keyboard.press("Escape");

    }
  }
  await page.setViewportSize({ width: 390, height: 900 });
  await page.locator("#locale-switcher").selectOption("ru");
  await openStandaloneProfile(page, "R-Z645");
  await expect(page.locator("#profile-content h3").first()).toHaveText("R-Z645", { timeout: 20_000 });
  const country = page.locator("#profile-content .profile-country-chip").first();
  expect(Math.abs(await center(country.locator(".fi")) - await center(country.locator("b")))).toBeLessThan(1);
});

test("BR-209: compact desktop shows the complete default Formed table without page scroll", async ({ page }) => {
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1366, height: 768 },
    { width: 1536, height: 864 },
  ]) {
    await page.setViewportSize(viewport);
    await ready(page);
    for (const locale of ["ru", "en",]) {
      await page.locator("#locale-switcher").selectOption(locale);
      const rows = page.locator("#result-body tr[data-result-role]");
      await expect(rows).toHaveCount(6);
      const lastRow = (await rows.last().boundingBox())!;
      const geometry = await page.evaluate(() => ({
        viewportHeight: innerHeight,
        pageHeight: document.documentElement.scrollHeight,
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
      }));
      if (viewport.width >= 1366) {
        expect(lastRow.y + lastRow.height, `${viewport.width}x${viewport.height} ${locale}`).toBeLessThanOrEqual(geometry.viewportHeight);
        expect(geometry.pageHeight, `${viewport.width}x${viewport.height} ${locale}`).toBeLessThanOrEqual(geometry.viewportHeight);
      } else {
        // 1280×720 is an additional compact check, not one of the required no-scroll
        // acceptance viewports. All rows must remain reachable without horizontal loss.
        expect(lastRow.y + lastRow.height, `${viewport.width}x${viewport.height} ${locale}`).toBeLessThanOrEqual(geometry.pageHeight);
      }
      expect(geometry.pageWidth, `${viewport.width}x${viewport.height} ${locale}`).toBeLessThanOrEqual(geometry.viewportWidth);
    }
  }
});

test("BR-210: desktop query labels and controls share two continuous axes", async ({ page }) => {
  await ready(page);
  for (const width of [1280, 1366, 1440, 1707]) {
    await page.setViewportSize({ width, height: 900 });
    for (const locale of ["ru", "en",]) {
      await page.locator("#locale-switcher").selectOption(locale);
      const geometry = await page.evaluate(() => {
        const rects = (selectors: string[]) => selectors.map(selector =>
          document.querySelector<HTMLElement>(selector)!.getBoundingClientRect());
        const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
        const labels = rects([
          "#query-evidence-label", "#query-target-control > .annotated-label > label", "#max-delta-label",
          "#min-result-samples-label", "#presence-label",
          "#query-crossing-control > .annotated-label > label",
        ]);
        const controls = rects([
          "#selection-panel-toggle", "#target-year", ".delta-stepper",
          "#min-result-samples", "#presence-mode-toggle", ".query-binary-switch",
        ]);
        const zoneElement = document.querySelector<HTMLElement>(".query-zone")!;
        const zone = zoneElement.getBoundingClientRect();
        const scale = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
        const inset = parseFloat(getComputedStyle(zoneElement).paddingLeft) * scale;
        return {
          labelTopSpread: spread(labels.map(rect => rect.top)),
          labelHeightSpread: spread(labels.map(rect => rect.height)),
          controlTopSpread: spread(controls.map(rect => rect.top)),
          controlBottomSpread: spread(controls.map(rect => rect.bottom)),
          controlHeights: controls.map(rect => rect.height),
          leftInset: Math.abs(controls[0].left - zone.left - inset),
          rightInset: Math.abs(zone.right - document.querySelector("#query-crossing-control")!.getBoundingClientRect().right - inset),
          methodNote: document.querySelector(".query-zone .inline-method-note") !== null,
          overflow: document.documentElement.scrollWidth - innerWidth,
        };
      });
      expect(geometry.labelTopSpread, `${width}px ${locale} label axis`).toBeLessThan(1);
      expect(geometry.labelHeightSpread, `${width}px ${locale} label height`).toBeLessThan(1);
      expect(geometry.controlTopSpread, `${width}px ${locale} control axis`).toBeLessThan(1);
      expect(
        geometry.controlBottomSpread,
        `${width}px ${locale} control height ${JSON.stringify(geometry.controlHeights)}`,
      ).toBeLessThan(1);
      // Fractional grid tracks can leave a 1/64px rounding remainder at the edge.
      expect(geometry.leftInset, `${width}px ${locale} left inset`).toBeLessThanOrEqual(1);
      expect(geometry.rightInset, `${width}px ${locale} right inset`).toBeLessThanOrEqual(1);
      expect(geometry.methodNote, `${width}px ${locale} redundant method note`).toBe(false);
      expect(geometry.overflow, `${width}px ${locale} overflow`).toBeLessThanOrEqual(0);
    }
  }
});
