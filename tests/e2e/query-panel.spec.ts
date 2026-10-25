import { expect, test } from "@playwright/test";
import { compact } from "../../scripts/semantic-audit/fixtures.mjs";

test("query panel applies temporal-pool country thresholds across locales and widths", async ({ page }) => {
  test.setTimeout(60000);
  const data = compact([-1, 0, 0], [18000, 8600, 8600], [[1, 0, 8], [1, 1, 3], [2, 0, 2]]);
  data.countryCodes = ["RUS", "POL", "FRA"];
  data.nodeIds = ["R-SYN-ROOT", "R-SYN-PAIR", "R-SYN-SINGLE"];
  data.projectIds = ["R"];
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/data/hras-index.json", route => route.fulfill({ json: data }));
  await page.goto("/?lang=ru&countries=RUS,POL&presence=any&target=8600&window=0&min=5");
  await expect(page.locator('#result-body tr[data-result-role="formed"]')).toHaveCount(2);
  await expect(page.locator("#min-result-samples")).toBeDisabled();
  await expect(page.locator(".country-pill-inactive")).toHaveCount(0);
  await expect(page.locator("#country-condition-summary")).toBeHidden();
  await expect(page.locator("#presence-switch-label")).toHaveText("Все ветви");
  await page.locator('#presence-mode-toggle [data-presence="all"]').click();
  await expect(page.locator("#presence-switch-label")).toHaveText("Общие ветви");
  await expect(page.locator("#min-result-samples")).toBeEnabled();
  await expect(page.locator('#result-body tr[data-result-role="formed"]')).toHaveCount(2);
  await page.locator("#min-result-samples").fill("3");
  await expect(page.locator("#country-condition-summary")).toBeHidden();
  await expect(page.locator('#result-body tr[data-result-role="formed"]')).toHaveCount(1);
  await page.locator("#min-result-samples").fill("11");
  await expect(page.locator("#country-condition-summary")).toBeHidden();
  await expect(page.locator('#result-body tr[data-result-role="formed"]')).toHaveCount(0);
  await page.locator("#min-result-samples").fill("5");
  await page.locator('[data-delta-step="50"]').click();
  await expect(page.locator("#max-delta-ybp")).toHaveValue("50");
  await page.locator('[data-delta-step="-50"]').click();
  await expect(page.locator("#max-delta-ybp")).toHaveValue("0");
  await page.locator('[data-era="CE"]').click();
  await expect(page.locator("#target-era")).toHaveAttribute("aria-checked", "true");
  await page.locator('[data-era="CE"]').click();
  await expect(page.locator("#target-era")).toHaveAttribute("aria-checked", "true");
  await page.locator('[data-era="BCE"]').click();
  await expect(page.locator("#target-year")).toHaveValue("6651");
  await page.locator("#include-crossing").check();
  for (const width of [340, 390, 760, 761, 1279, 1280, 1440, 2560]) {
    await page.setViewportSize({ width, height: 1100 });
    for (const locale of ["ru", "en",]) {
      await page.locator("#locale-switcher").selectOption(locale);
      const geometry = await page.locator(".query-zone").evaluate(panel => {
        const bounds = panel.getBoundingClientRect();
        const controls = [...document.querySelectorAll<HTMLElement>("#sample-scope, #selection-panel-toggle, #min-result-samples, #presence-mode-toggle, #target-year, #target-era, .delta-stepper, .query-binary-switch, #density-step, #density-anchor, .density-sync-label")];
        const boxes = controls.map(el => el.getBoundingClientRect());
        const step = panel.querySelector("#density-step")!.getBoundingClientRect();
        const anchor = panel.querySelector("#density-anchor")!.getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth > innerWidth,
          chartFieldsAligned: Math.abs(step.top - anchor.top) <= 1 && Math.abs(step.bottom - anchor.bottom) <= 1,
          outside: boxes.some(b => b.left < bounds.left - 1 || b.right > bounds.right + 1),
          overlap: boxes.some((a, i) => boxes.some((b, j) => i < j && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1)) };
      });
      expect(geometry, `${width}/${locale}`).toEqual({ overflow: false, outside: false, overlap: false, chartFieldsAligned: true });
      if (locale === "ru" && [390, 1440].includes(width)) {
        await page.locator(".query-zone").screenshot({ path: `output/query-panel/panel-${width}.png` });
      }
    }
  }
  expect(errors).toEqual([]);
});
