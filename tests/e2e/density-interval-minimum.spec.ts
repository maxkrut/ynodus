import { expect, test } from '@playwright/test';

test('updated minimum notes fit the desktop and disclose interval versus table scope', async ({page}) => {
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/?lang=ru&countries=DZA,LBY,MAR,MRT,TUN&preset=maghreb&presence=all&min=5&target=15900&window=300');
  await expect(page.locator('#live-status')).toHaveAttribute('data-busy','false');
  for(const locale of ['ru','en']) {
    await page.locator('#locale-switcher').selectOption(locale);
    await page.locator('[data-annotation="minimum"]').click();
    const note=page.locator('#context-annotation');
    await expect(note).toBeVisible();
    await expect(note).toContainText(locale==='ru'?'для каждого столбца':'each column');
    const bounds=await note.evaluate(el=>({overflow:el.scrollHeight-el.clientHeight,bottom:el.getBoundingClientRect().bottom,top:el.getBoundingClientRect().top}));
    expect(bounds.overflow).toBeLessThanOrEqual(1);
    expect(bounds.top).toBeGreaterThanOrEqual(0);
    expect(bounds.bottom).toBeLessThanOrEqual(900);
    await note.screenshot({path:`output/interval-minimum/minimum-note-${locale}.png`});
    await page.keyboard.press('Escape');
  }
});

test('Maghreb keeps independent interval pools across linear/log dates and chart-only settings', async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    localStorage.setItem('ynodus-density-settings-v2', JSON.stringify({ step: 300, anchor: 'axis', sync: false, measure: 'count' }));
    (window as any).analysisPosts = 0;
    const send = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function(message: any, ...rest: any[]) {
      if (message.type === 'analyze') (window as any).analysisPosts++;
      return Reflect.apply(send, this, [message, ...rest]);
    };
  });
  await page.goto('/?lang=ru&countries=DZA,LBY,MAR,MRT,TUN&preset=maghreb&presence=all&min=5&target=15900&window=300');
  const ready = async () => {
    await expect(page.locator('#live-status')).toHaveAttribute('data-busy', 'false');
    await expect(page.locator('#target-density')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('#target-density button').first()).toBeVisible();
  };
  const bars = () => page.locator('#target-density button').evaluateAll(nodes => nodes.map(node => ({
    bin: (node as HTMLElement).dataset.densityIndex,
    count: (node as HTMLElement).dataset.densityCount,
    fills: node.querySelector('.density-macro-stack')?.innerHTML,
    countries: (node as HTMLElement).dataset.tooltip?.split('\n').find(line => line.startsWith('Обязательные страны интервала:')),
  })));
  await ready();
  const baseline = await bars();
  const total = baseline.reduce((sum, bar) => sum + Number(bar.count), 0);
  expect(baseline.some(bar => bar.countries?.includes('MRT'))).toBe(true);
  expect(baseline.some(bar => bar.countries && !bar.countries.includes('MRT'))).toBe(true);
  await page.evaluate(() => { (window as any).firstDensityButton = document.querySelector('#target-density button'); });
  const results: {date: number; rows: number}[] = [];
  for (const date of [1051, 3051, 13951, 16551]) {
    const posts = await page.evaluate(() => (window as any).analysisPosts);
    await page.locator('#target-year').fill(String(date));
    await page.locator('#target-year').press('Tab');
    await expect.poll(() => page.evaluate(() => (window as any).analysisPosts)).toBeGreaterThan(posts);
    await ready();
    expect(await bars()).toEqual(baseline);
    expect(await page.evaluate(() => (window as any).firstDensityButton === document.querySelector('#target-density button'))).toBe(true);
    results.push({ date, rows: await page.locator('#result-body tr[data-result-role]').count() });
    if (date === 1051 || date === 13951) {
      await page.mouse.move(0, 0); await page.keyboard.press('Escape');
      await page.locator('.timeline-zone').screenshot({path: `output/interval-minimum/maghreb-${date}.png`});
    }
  }
  // A held pointer also retains the exact columns; only pending state/outline changes.
  const slider = page.locator('#target-slider');
  for (const fraction of [.2, .75]) {
    await slider.scrollIntoViewIfNeeded();
    const box = (await slider.boundingBox())!;
    const posts = await page.evaluate(() => (window as any).analysisPosts);
    await page.mouse.move(box.x + box.width * .5, box.y + box.height / 2);
    await page.mouse.down(); await page.mouse.move(box.x + box.width * fraction, box.y + box.height / 2, {steps: 4});
    expect(await bars()).toEqual(baseline);
    await page.mouse.up();
    await expect.poll(() => page.evaluate(() => (window as any).analysisPosts)).toBeGreaterThan(posts);
    await ready(); expect(await bars()).toEqual(baseline);
  }
  await page.locator('#max-delta-ybp').fill('150'); await page.locator('#max-delta-ybp').press('Tab');
  await ready(); expect(await bars()).toEqual(baseline);
  const before = await page.evaluate(() => (window as any).analysisPosts);
  const table = await page.locator('#result-body').innerText();
  await page.locator('#density-step').fill('600'); await page.locator('#density-step').press('Enter');
  await ready(); expect(await bars()).not.toEqual(baseline);
  expect(await page.evaluate(() => (window as any).analysisPosts)).toBe(before);
  expect(await page.locator('#result-body').innerText()).toBe(table);
  await page.locator('#density-step').fill('300'); await page.locator('#density-step').press('Enter');
  await ready(); expect(await bars()).toEqual(baseline);
  await page.locator('#density-anchor').selectOption('target'); await ready();
  expect(await bars()).not.toEqual(baseline);
  await page.locator('#density-sync').check();
  await page.locator('#max-delta-ybp').fill('0'); await page.locator('#max-delta-ybp').press('Tab');
  await expect(page.locator('#density-settings-status')).toBeVisible();
  await expect(page.locator('#target-density button')).toHaveCount(0);
  await page.locator('#density-sync').uncheck(); await ready();
  await expect(page.locator('#density-settings-status')).toBeHidden();
  expect(errors).toEqual([]);
  console.log(JSON.stringify({ maghrebChartSubclades: total, results }));
});

test('real scoped result uses the compact profile header and full-width matrix', async ({page}) => {
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/?lang=ru&countries=BGR,BIH,BLR,CZE,HRV,MKD,MNE,POL,RUS,SRB,SVK,SVN,UKR&target=5300&window=300&min=5&presence=all');
  const opener=page.locator('[data-open-result-detail="R-Z645"]');
  await expect(opener).toBeVisible();
  const before=await opener.locator('xpath=ancestor::tr').locator('.table-total strong').innerText();
  await opener.click();
  const root=page.locator('#profile-content');
  await expect(root.locator('.profile-compact-header')).toBeVisible();
  await expect(root.locator('[data-profile-scope-total]')).toHaveText(before);
  await expect(root.locator('.tree-sheet-clean')).toBeVisible();
  const first=root.locator('.profile-country-chip').first();
  await first.click();
  await expect(first).toHaveAttribute('aria-pressed','true');
  await expect(root.locator('[data-profile-country-reset]')).toBeEnabled();
  await root.locator('[data-profile-country-reset]').click();
  await expect(root.locator('[data-profile-scope-total]')).toHaveText(before);
  await page.mouse.move(0,0); await page.keyboard.press('Escape');
  await root.screenshot({path:'output/interval-minimum/result-profile.png'});
  await page.locator('#locale-switcher').selectOption('en');
  await page.locator('#profile-workspace [data-research-back]').click();
  await expect(opener).toBeVisible();
  await expect(page.locator('#locale-switcher')).toHaveValue('en');
  await expect(page).toHaveURL(/countries=/);
});
