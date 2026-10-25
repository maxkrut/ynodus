import { expect, test } from "@playwright/test";
import { layoutFixture } from "../fixtures/layout.mjs";

for (const width of [390, 1440]) {
  test(`supported languages and unknown-language fallback at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/data/hras-index.json", route => route.fulfill({ json: layoutFixture() }));
    await page.goto("/?lang=unsupported&view=time&countries=RUS,POL&presence=any&min=0&target=5449");
    await expect(page.locator("#export-csv")).toBeEnabled();
    expect(await page.locator("#locale-switcher option").evaluateAll(options => options.map(option => (option as HTMLOptionElement).value)))
      .toEqual(["en", "ru"]);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page).toHaveURL(/lang=en/);
    await page.screenshot({ path: `output/i18n-review/languages-${width}-en.png`, fullPage: true });
    await page.locator("#locale-switcher").selectOption("en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page.reload();
    await expect(page.locator("#locale-switcher")).toHaveValue("en");
    await expect(page.locator("#export-csv")).toBeEnabled();
    expect(new URL(page.url()).searchParams.get("countries")).toBe("POL,RUS");
    await page.locator("#locale-switcher").selectOption("ru");
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `output/i18n-review/languages-${width}.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}
