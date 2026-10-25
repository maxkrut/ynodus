import { expect, test, type Page } from '@playwright/test';
import { ANNOTATIONS, renderAnnotation, type AnnotationId } from '../../src/app/annotation-markup';
import { translate } from '../../src/app/i18n';
import { layoutFixture, layoutQuery } from '../fixtures/layout.mjs';

async function ready(page: Page) {
  await page.route('**/data/hras-index.json', route => route.fulfill({ json: layoutFixture() }));
  await page.goto(layoutQuery);
  await expect(page.locator('#export-csv')).toBeEnabled();
}

test('hover waits 800 ms and cancels on departure, Escape or language change; clicks and focus open immediately', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await ready(page);
  const badge = page.locator('[data-annotation="window"]');
  const panel = page.locator('#context-annotation');
  const box = (await badge.boundingBox())!;
  const hover = () => page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.move(1, 1);
  await page.clock.install({ time: new Date('2026-10-20T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-20T00:00:01Z'));
  await hover();
  // Auto-scrolling to a control must not cancel its delayed explanation.
  await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
  await page.clock.runFor(799);
  await expect(panel).toBeHidden();
  await page.clock.runFor(1);
  await expect(panel).toBeVisible();
  await page.mouse.move(1, 1);
  await page.clock.runFor(200);
  await expect(panel).toBeHidden();
  await hover();
  await page.clock.runFor(400);
  await page.mouse.move(1, 1);
  await page.clock.runFor(1000);
  await expect(panel).toBeHidden();
  await hover();
  await page.keyboard.press('Escape');
  await page.clock.runFor(1000);
  await expect(panel).toBeHidden();
  await page.mouse.move(1, 1);
  await hover();
  await page.locator('#locale-switcher').selectOption('en');
  await page.clock.runFor(1000);
  await expect(panel).toBeHidden();
  await page.clock.resume();
  await badge.click();
  await expect(panel).toBeVisible();
  await page.mouse.move(1, 1);
  await expect(panel).toBeVisible();
  await badge.click();
  await expect(panel).toBeHidden();
  await page.locator('#target-year').focus();
  await badge.focus();
  await expect(panel).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
});

for (const [width, height] of [[1440, 900], [1024, 600], [390, 844], [320, 600]]) {
  test(`all notes fit the viewport at ${width}×${height}; only short phones may scroll`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height });
    await ready(page);
    const errors: string[] = [];
    const scrollFallbacks: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const panel = page.locator('#context-annotation');
    const subjects = Object.keys(ANNOTATIONS) as AnnotationId[];
    for (const locale of ['ru', 'en',] as const) {
      // Leave the previously inspected chart cell before replacing the fixture:
      // a stationary pointer may otherwise open its passive hint over the test anchor.
      await page.mouse.click(1, 1);
      await page.locator('#locale-switcher').selectOption(locale);
      await expect(panel).toBeHidden();
      // Exercise every shared-note subject through the real event binding,
      // including subjects normally reached in a different workspace.
      await page.evaluate(html => {
        document.querySelector('#popup-fixture')?.remove();
        const host = document.createElement('div');
        host.id = 'popup-fixture';
        host.style.cssText = 'position:fixed;left:45%;top:45%;z-index:900';
        host.innerHTML = html;
        document.querySelector('#app')!.append(host);
      }, renderAnnotation('window', key => translate(locale, key)));
      const trigger = page.locator('#popup-fixture button');
      async function fits(label: string) {
        const geometry = await panel.evaluate(el => {
          const r = el.getBoundingClientRect();
          return { left: r.left, top: r.top, right: r.right, bottom: r.bottom,
            x: el.scrollWidth - el.clientWidth, y: el.scrollHeight - el.clientHeight,
            vw: innerWidth, vh: innerHeight };
        });
        expect(geometry.x, label).toBeLessThanOrEqual(1);
        // Very short phones retain an accessible scroll fallback for full source notes.
        if (width > 760 || height >= 700) expect(geometry.y, label).toBeLessThanOrEqual(1);
        if (geometry.y > 1) scrollFallbacks.push(label);
        expect(geometry.left, label).toBeGreaterThanOrEqual(5);
        expect(geometry.top, label).toBeGreaterThanOrEqual(5);
        expect(geometry.right, label).toBeLessThanOrEqual(geometry.vw - 5);
        expect(geometry.bottom, label).toBeLessThanOrEqual(geometry.vh - 5);
      }
      for (const subject of subjects) {
        await trigger.evaluate((el, id) => { (el as HTMLElement).dataset.annotation = id; }, subject);
        await trigger.click({ timeout: 3000 });
        await expect(panel).toBeVisible();
        if (subject === 'date') {
          await panel.locator('summary').click();
          await expect(panel.locator('details')).toHaveAttribute('open', '');
        }
        await fits(`${locale}/${subject}`);
        if (locale === 'ru' && ['source-sync', 'periods'].includes(subject)) {
          await page.screenshot({ path: `output/playwright/popup-${subject}-${width}.png` });
        }
        await page.keyboard.press('Escape');
        await expect(panel).toBeHidden();
      }
      await page.evaluate(() => document.querySelector('#popup-fixture')?.remove());
      await page.locator('[data-density-measure="per1000"]').click();
      const index = await page.locator('button.density-cell').evaluateAll(cells => [...cells]
        .sort((a, b) => Number(b.getAttribute('data-density-count')) - Number(a.getAttribute('data-density-count')))[0].getAttribute('data-density-index'));
      const cell = page.locator(`button.density-cell[data-density-index="${index}"]`);
      const url = page.url();
      await cell.focus();
      await expect(panel).toBeVisible();
      await expect(panel.locator('.annotation-facts').first()).toContainText('1 000');
      await fits(`${locale}/interval`);
      await panel.locator('details > summary').click();
      await fits(`${locale}/interval-parent-groups`);
      expect(page.url()).toBe(url);
      if (locale === 'ru') await page.screenshot({ path: `output/playwright/popup-interval-${width}.png` });
      await page.keyboard.press('Escape');
      await page.evaluate(() => document.querySelector('#popup-fixture')?.remove());
    }
    expect(errors).toEqual([]);
    await test.info().attach('scroll-fallbacks', { body: JSON.stringify(scrollFallbacks), contentType: 'application/json' });
  });
}
