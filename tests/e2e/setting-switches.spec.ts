import { expect, test } from '@playwright/test';
import { layoutFixture, layoutQuery } from '../fixtures/layout.mjs';

for (const width of [340, 390, 768, 1440]) test(`labelled settings switches at ${width}`, async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width, height: 1100 });
  await page.route('**/data/hras-index.json', route => route.fulfill({ json: layoutFixture() }));
  await page.goto(layoutQuery);
  const crossing = page.locator('#include-crossing');
  const sync = page.locator('#density-sync');
  const presence = page.locator('#presence-mode-toggle');
  const label = (id: string) => page.locator(`label.setting-switch:has(#${id})`);
  const visibleState = (id: string) => label(id).locator('.setting-switch-state > :visible');
  const ready = () => expect(page.locator('#export-csv')).toBeEnabled();
  await ready();
  for (const locale of ['ru', 'en']) {
    await page.locator('#locale-switcher').selectOption(locale);
    const off = locale === 'ru' ? 'Выключено' : 'Disabled';
    const on = locale === 'ru' ? 'Включено' : 'Enabled';
    for (const input of [crossing, sync]) {
      await input.uncheck();
      await expect(input).toHaveAttribute('role', 'switch');
    }
    await expect(visibleState('include-crossing')).toHaveText(off);
    await expect(visibleState('density-sync')).toHaveText(off);
    await expect(crossing).toHaveAccessibleName(locale === 'ru' ? 'Добавить переходы через дату Родитель → потомок' : 'Add transitions spanning date Parent → child');
    await expect(sync).toHaveAccessibleName(locale === 'ru' ? 'Брать шаг из окна' : 'Use window for step');
    await label('include-crossing').click();
    await expect(crossing).toBeChecked();
    await expect(visibleState('include-crossing')).toHaveText(on);
    await expect(page.locator('tr[data-result-role="crossing"]')).toHaveCount(3);
    await expect(visibleState('density-sync')).toHaveText(off);
    await ready();
    await page.mouse.move(0, 0);
    await page.locator('.query-zone').screenshot({ path: `output/setting-switches/mixed-${width}-${locale}.png` });
    await label('density-sync').click();
    await expect(sync).toBeChecked();
    await expect(visibleState('density-sync')).toHaveText(on);
    await expect(page.locator('#density-step')).toBeDisabled();
    await expect(page.locator('#density-step')).toHaveValue('200');
    for (const id of ['include-crossing', 'density-sync']) {
      const input = page.locator(`#${id}`);
      await input.focus(); await page.keyboard.press('Space');
      await expect(input).not.toBeChecked(); await expect(visibleState(id)).toHaveText(off);
      await page.keyboard.press('Space');
      await expect(input).toBeChecked(); await expect(visibleState(id)).toHaveText(on);
    }
    await presence.locator('[data-presence="all"]').click();
    await expect(presence).toHaveAttribute('aria-checked', 'true');
    await presence.locator('[data-presence="all"]').click();
    await expect(presence).toHaveAttribute('aria-checked', 'true');
    await presence.locator('[data-presence="any"]').click();
    await expect(presence).toHaveAttribute('aria-checked', 'false');
    await ready();
    const geometry = await page.locator('.setting-switch').evaluateAll(labels => labels.map(element => {
      const input = element.querySelector('input')!.getBoundingClientRect();
      const copy = element.querySelector('.setting-switch-copy')!.getBoundingClientRect();
      const outer = element.getBoundingClientRect();
      return { drift: Math.abs(input.top + input.height / 2 - copy.top - copy.height / 2),
        fits: copy.bottom <= outer.bottom + 1 && copy.top >= outer.top - 1 && outer.right <= innerWidth + 1 };
    }));
    await info.attach(`geometry-${locale}`, { body: JSON.stringify(geometry), contentType: 'application/json' });
    expect(geometry.every(g => g.drift < 1 && g.fits)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('[data-research-view="profile"]').click();
    await expect(page.locator('#profile-workspace')).toBeVisible();
    await page.locator('[data-research-view="time"]').click();
    await expect(crossing).toBeChecked(); await expect(sync).toBeChecked();
    await expect(visibleState('include-crossing')).toHaveText(on);
    await expect(visibleState('density-sync')).toHaveText(on);
    await page.reload(); await ready();
    await expect(crossing).toBeChecked(); await expect(sync).toBeChecked();
    await expect(visibleState('include-crossing')).toHaveText(on);
    await expect(visibleState('density-sync')).toHaveText(on);
  }
  expect(errors).toEqual([]);
});
