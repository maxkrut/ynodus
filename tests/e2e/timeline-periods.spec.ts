import { expect, test, type Page } from "@playwright/test";
import { compact } from "../../scripts/semantic-audit/fixtures.mjs";

async function openTimeline(page: Page) {
  const data = compact([-1, 0, 1], [235900, 5500, 500], [[2, 0, 3]]);
  data.countryCodes = ["RUS"];
  data.countryCounts = [3];
  await page.route("**/data/hras-index.json", route => route.fulfill({ json: data }));
  await page.goto("/?lang=ru&countries=RUS&presence=any&target=5500&window=100&min=0");
  await expect(page.locator('#result-body tr[data-result-role="formed"]')).toHaveCount(1);
}

test("all eight period bands retain the correct BCE and CE calendar boundaries", async ({ page }) => {
  await openTimeline(page);
  for (const width of [340, 390, 760, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const locale of ["ru", "en",]) {
      await page.locator("#locale-switcher").selectOption(locale);
      const axis = await page.evaluate(() => {
        const bands = [...document.querySelectorAll<HTMLElement>("[data-period-band]")];
        const max = Number((document.querySelector("#target-slider") as HTMLInputElement).max);
        return { max, bands: bands.map(band => ({
          key: band.dataset.periodBand, hidden: band.hidden,
          left: parseFloat(band.style.left), width: parseFloat(band.style.width),
          pixels: band.getBoundingClientRect().width, title: band.title,
        })) };
      });
      expect(axis.bands.map(band => band.key)).toEqual([
        "paleolithic", "mesolithic", "neolithic", "chalcolithic", "bronze", "iron", "medieval", "modern",
      ]);
      // Independent calendar oracle: no year zero; CE 500 = 1450 YBP,
      // CE 1500 = 450 YBP, CE 1950 = 0 YBP. All these bounds are linear.
      const bounds = [null, -10000, -8000, -5500, -3300, -1200, 500, 1500, 1950];
      const percent = (year: number | null) => year === null ? 0
        : 100 * (1 - (year < 0 ? 1949 - year : 1950 - year) / axis.max);
      axis.bands.forEach((band, index) => {
        const label = `${width}px ${locale} ${band.key}`;
        expect(band.hidden, label).toBe(false);
        expect(band.pixels, label).toBeGreaterThan(1);
        expect(band.left, label).toBeCloseTo(percent(bounds[index]), 5);
        expect(band.width, label).toBeCloseTo(percent(bounds[index + 1]) - percent(bounds[index]), 5);
      });
      expect(axis.bands[6].title.replace(/[\s,]/g, "")).toMatch(/500.*1500/);
      expect(axis.bands[7].title.replace(/[\s,]/g, "")).toMatch(/1500.*1950/);
    }
  }
  // The target marker and historical boundary must use the same coordinates.
  await page.locator('#target-era [data-era="CE"]').click();
  await expect(page.locator("#target-era")).toHaveAttribute("aria-checked", "true");
  for (const [year, key] of [[500, "medieval"], [1500, "modern"]] as const) {
    await page.locator("#target-year").fill(String(year));
    await page.locator("#target-year").press("Tab");
    await expect.poll(() => page.evaluate(key => {
      const axis = document.querySelector<HTMLElement>(".time-axis")!;
      const band = document.querySelector<HTMLElement>(`[data-period-band="${key}"]`)!;
      return Math.abs(parseFloat(axis.style.getPropertyValue("--target-pos")) - parseFloat(band.style.left));
    }, key)).toBeLessThan(0.001);
  }
});

test("period source footnote is localized, keyboard accessible and fits narrow screens", async ({ page, browserName }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await openTimeline(page);
  const summary = page.locator('[data-annotation="periods"]');
  const panel = page.locator("#context-annotation");
  const guide = panel;
  const evidence = process.env.YNODUS_QA_EVIDENCE_DIR
    ? `${process.env.YNODUS_QA_EVIDENCE_DIR}/${browserName}`
    : "output/timeline-periods";
  await expect(panel).not.toBeVisible();
  for (const width of [340, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const locale of ["ru", "en",]) {
      await page.locator("#locale-switcher").selectOption(locale);
      await summary.scrollIntoViewIfNeeded();
      await summary.focus();
      await page.keyboard.press("Enter");
      await expect(panel).toBeVisible();
      await expect(summary).toContainText({ ru: "источники", en: "sources", }[locale]!);
      await expect(guide.locator("dt")).toHaveCount(8);
      await expect(guide.locator('[data-period-range="medieval"]')).toContainText("500");
      await expect(guide.locator('[data-period-range="modern"]')).toContainText(/1[\s,]?950/);
      expect(await guide.locator("a").evaluateAll(links => links.map(link => (link as HTMLAnchorElement).href))).toEqual([
        "https://www.metmuseum.org/toah/ht/02/wae.html",
        "https://www.metmuseum.org/toah/ht/03/wae.html",
        "https://historicengland.org.uk/listing/the-list/historic-periods/",
        "https://www.dhm.de/en/exhibitions/permanent-exhibition/middle-ages/",
        "https://www.yfull.com/faq/definitions/",
      ]);
      await expect(guide.locator('[data-i18n="periodGuideEndpoint"]')).toContainText(
        { ru: "единая база экспорта неизвестна", en: "this export's common baseline is unknown", }[locale]!,
      );
      const geometry = await panel.evaluate(el => ({
        left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right,
        overflow: el.scrollWidth - el.clientWidth,
        pageOverflow: document.documentElement.scrollWidth - innerWidth,
      }));
      expect(geometry.left).toBeGreaterThanOrEqual(0);
      expect(geometry.right).toBeLessThanOrEqual(width);
      expect(geometry.overflow).toBeLessThanOrEqual(1);
      expect(geometry.pageOverflow).toBeLessThanOrEqual(0);
      await page.keyboard.press("Tab");
      // Firefox exposes the independently scrollable note before its links.
      if (await panel.evaluate(el => document.activeElement === el)) await page.keyboard.press("Tab");
      await expect(guide.locator("a").first()).toBeFocused();
      const ageSource = guide.locator('a[href="https://www.yfull.com/faq/definitions/"]');
      await ageSource.focus();
      await expect(ageSource).toBeFocused();
      expect(await ageSource.evaluate(el => {
        const box = el.getBoundingClientRect();
        const panel = el.closest("#context-annotation")!.getBoundingClientRect();
        return Math.max(panel.top - box.top, box.bottom - panel.bottom);
      })).toBeLessThanOrEqual(0);
      await panel.evaluate(el => { el.scrollTop = 0; });
      if (width !== 340) {
        await panel.screenshot({ path: `${evidence}/note-${width}-${locale}.png` });
      }
      await summary.focus();
      await page.keyboard.press("Enter");
      await expect(panel).not.toBeVisible();
      if (locale === "ru" && width !== 340) {
        await page.locator(".timeline-zone").screenshot({ path: `${evidence}/timeline-${width}.png` });
      }
    }
  }
  expect(errors).toEqual([]);
});
