import { expect, test } from "@playwright/test";
import { compact } from "../../scripts/semantic-audit/fixtures.mjs";

test("the calendar annotation and primary source survive locale changes and fit mobile", async ({ page, browserName }) => {
  const data = compact([-1], [5500], [[0, 0, 3]]);
  data.countryCodes = ["RUS"];
  data.countryCounts = [3];
  await page.route("**/data/hras-index.json", route => route.fulfill({ json: data }));
  const phrases = { ru: "а не 1950 года", en: "not 1950", };
  for (const locale of ["ru", "en",] as const) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/?lang=${locale}&countries=RUS&target=5500&window=100&min=0`);
    await expect(page.locator('#result-body tr[data-result-role="formed"]')).toHaveCount(1);
    await page.locator('[data-annotation="date"]').click();
    const help = page.locator("#context-annotation");
    await expect(help).toContainText(phrases[locale]);
    const source = help.locator('[href="https://www.yfull.com/faq/definitions/"]');
    await expect(source).toHaveCount(1);
    await expect(source).toHaveAttribute("rel", "noopener noreferrer");
    await source.focus();
    await expect(source).toBeFocused();
    expect(await help.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    if (process.env.YNODUS_QA_EVIDENCE_DIR) {
      await help.screenshot({ path: `${process.env.YNODUS_QA_EVIDENCE_DIR}/age-annotation-${browserName}-${locale}.png` });
    }
    await page.keyboard.press("Escape");
    await expect(help).toBeHidden();
  }
  await page.locator("#locale-switcher").selectOption("ru");
  await page.locator('[data-annotation="date"]').click();
  await expect(page.locator('#context-annotation a')).toContainText("определение");
});
