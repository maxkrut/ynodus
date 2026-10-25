import {expect,test} from '@playwright/test';
import {startAudit,analyses,markChart,sameChart,fit,capture} from './visual-audit-support';
import {layoutQuery} from '../fixtures/layout.mjs';

for(const width of [390,1440]) for(const lang of ['ru','en']){
  test(`local actions preserve the timeline and do not analyze: ${lang} ${width}`,async({page})=>{
    const errors=await startAudit(page,width,lang);
    const before=await analyses(page);await markChart(page);
    await test.step('sort, macrogroup filter and same selected mode',async()=>{
      await page.locator('[data-table-sort="total"]').first().click();
      const filter=page.locator('#result-macrogroup-filter');
      await filter.selectOption({index:1});await filter.selectOption('');
      await page.locator('[data-presence="any"]').click();
      await page.locator('#target-era [data-era="BCE"]').click();
    });
    await test.step('annotations, country search, closing the picker',async()=>{
      await page.locator('[data-annotation="window"]').click();
      await expect(page.locator('#context-annotation')).toBeVisible();
      await page.keyboard.press('Escape');
      await page.locator('#selection-panel-toggle').click();
      await page.locator('#country-search').fill('RUS');
      await expect(page.locator('#country-list [data-country-code]')).toHaveCount(1);
      await page.keyboard.press('Escape');
      await expect(page.locator('#selection-panel-toggle')).toBeFocused();
    });
    await page.waitForTimeout(450);
    expect(await analyses(page)).toBe(before);expect(await sameChart(page)).toBe(true);
    await fit(page);expect(errors).toEqual([]);
  });

  test(`unchanged queries never enter pending or replace bars: ${lang} ${width}`,async({page})=>{
    await startAudit(page,width,lang,layoutQuery.replace('window=100','window=0'));
    const before=await analyses(page);await markChart(page);
    await capture(page,`noop-before-${lang}-${width}`,'.timeline-zone');
    // The boundary button is a real click; the window must remain exactly zero.
    await page.locator('[data-delta-target="max-delta-ybp"]').first().click();
    await expect(page.locator('#max-delta-ybp')).toHaveValue('0');
    await capture(page,`noop-during-${lang}-${width}`,'.timeline-zone');
    await expect(page.locator('#export-csv')).toBeEnabled();
    await expect(page.locator('#target-density')).not.toHaveAttribute('aria-busy','true');
    await page.waitForTimeout(450);expect(await analyses(page)).toBe(before);
    await page.locator('button.density-cell[data-target-ybp="5500"]').click();
    await page.waitForTimeout(450);expect(await analyses(page)).toBe(before);
    expect(await sameChart(page)).toBe(true);
  });

  test(`complete workspace route and form journey: ${lang} ${width}`,async({page})=>{
    test.setTimeout(90000);
    const errors=await startAudit(page,width,lang,layoutQuery+'&crossing=1');
    const queryCountries=new URL(page.url()).searchParams.get('countries');
    await capture(page,`time-${lang}-${width}`);
    await page.locator('#result-body [data-result-countries]').first().click();
    await expect(page.locator('#result-countries-dialog')).toBeVisible();
    await capture(page,`row-countries-${lang}-${width}`,'#result-countries-dialog');
    await page.keyboard.press('Escape');
    const result=page.locator('#result-body [data-open-result-detail]').first();
    const id=await result.getAttribute('data-open-result-detail');await result.click();
    await expect(page.locator('#profile-content h3').first()).toHaveText(id!);
    await capture(page,`details-${lang}-${width}`,'#profile-workspace');
    await page.locator('#profile-workspace [data-research-back]').click();
    await expect(result).toBeFocused();
    await page.locator('.research-entrypoints [data-research-view="profile"]').click();
    await page.locator('#profile-clade-search').fill('R-SYN-100');
    await page.locator('#profile-lookup button[type="submit"]').click();
    await expect(page.locator('.profile-compact-header h3')).toHaveText('R-SYN-100');
    await page.locator('#profile-country-filter').selectOption('RUS');
    await page.locator('[data-profile-country-reset]').click();
    await page.locator('[data-evidence-tree-toggle="R-SYN-100"]').click();
    await page.locator('[data-evidence-tree-toggle="R-SYN-100"]').press('ArrowRight');
    await capture(page,`profile-${lang}-${width}`,'#profile-workspace');
    await page.locator('[data-profile-parent]').click();
    await expect(page.locator('.profile-compact-header h3')).toHaveText('R-SYN-ROOT');
    await page.locator('#profile-workspace [data-research-back]').click();
    await expect(page.locator('.profile-compact-header h3')).toHaveText('R-SYN-100');
    await page.locator('.tree-sheet [data-tree-node="R-SYN-100"] [data-country-evidence="RUS"]').click();
    await expect(page.locator('.branch-country-matrix')).toBeVisible();
    await capture(page,`branch-country-${lang}-${width}`,'#country-evidence-workspace');
    await page.locator('#country-evidence-workspace [data-research-back]').click();
    await page.locator('.research-entrypoints [data-research-view="country-overview"]').click();
    await page.locator('#country-overview-select').selectOption('RUS');
    await page.locator('#country-overview-form button[type="submit"]').click();
    await expect(page.locator('.country-compact-header')).toBeVisible();
    const countryReturn=page.locator('#country-overview-workspace [data-research-back]');
    const countryReturnText=await countryReturn.textContent();
    await page.locator('.country-comparison-open').click();
    const picker=page.locator('[data-comparison-dialog]');
    await picker.locator('[data-comparison-search]').fill('POL');
    await picker.locator('[data-country-code="POL"]').check();
    await picker.locator('[data-comparison-apply]').click();
    await expect(page.locator('.matrix-country-heading')).toHaveCount(2);
    await expect(countryReturn).toHaveText(countryReturnText!);
    await page.locator('[data-country-tree-filter]').selectOption('POL');
    await page.locator('.profile-country-reset').click();
    const column=page.locator('.matrix-country-heading[data-tree-country="POL"]');
    await column.focus();await page.keyboard.press('Space');
    await expect(column).toBeFocused();
    await page.locator('.profile-country-reset').click();
    await expect(page.locator('[data-country-tree-filter]')).toBeFocused();
    await page.locator('.country-comparison-open').click();
    await page.mouse.click(1,1);await expect(picker).not.toBeVisible();
    await expect(page.locator('.country-comparison-open')).toBeFocused();
    await capture(page,`overview-${lang}-${width}`,'#country-overview-workspace');
    await page.reload();await expect(page.locator('.matrix-country-heading')).toHaveCount(2);
    await page.locator('#locale-switcher').selectOption(lang==='ru'?'en':'ru');
    await expect(page.locator('.matrix-country-heading')).toHaveCount(2);
    await page.goBack();await page.goForward();
    expect(new URL(page.url()).searchParams.get('lang')).toBe(lang==='ru'?'en':'ru');
    expect(new URL(page.url()).searchParams.get('countries')).toBe(queryCountries);
    await page.locator('.research-entrypoints [data-research-view="time"]').click();
    await expect(page.locator('#time-workspace')).toBeVisible();
    await expect(page.locator('#export-csv')).toBeEnabled();
    await fit(page);expect(errors).toEqual([]);
  });
}

test('Crossing-only work keeps the committed Formed chart stable',async({page})=>{
  await startAudit(page);await markChart(page);
  await capture(page,'crossing-before','.timeline-zone');
  const before=await page.locator('button.density-cell').first().evaluate(el=>getComputedStyle(el).opacity);
  await page.evaluate(()=>(window as any).audit.hold=true);
  await page.locator('#include-crossing').check();
  await expect(page.locator('#target-density')).toHaveAttribute('aria-busy','false');
  await capture(page,'crossing-pending','.timeline-zone');
  const pending=await page.locator('button.density-cell').first().evaluate(el=>getComputedStyle(el).opacity);
  expect(await sameChart(page)).toBe(true);expect(pending).toBe(before);
  await test.info().attach('pending-chart',{body:JSON.stringify({before,pending}),contentType:'application/json'});
  await expect(page.locator('#export-csv')).toBeDisabled();
  await expect.poll(()=>page.evaluate(()=>(window as any).audit.held.length)).toBeGreaterThan(0);
  await page.evaluate(()=>{const a=(window as any).audit;a.hold=false;a.held.splice(0).forEach(send=>send());});
  await expect(page.locator('#export-csv')).toBeEnabled();
  expect(await sameChart(page)).toBe(true);
});

test('mouse focus respects the hint delay and hints never intercept nearby controls',async({page})=>{
  await startAudit(page);
  const field=page.locator('#target-year'),panel=page.locator('#context-annotation');
  await field.click();await expect(panel).toBeHidden();
  await page.mouse.move(1,1);
  await field.hover();await expect(panel).toBeVisible();
  await expect(panel).toHaveCSS('pointer-events','none');
  await page.locator('#density-sync').check();await expect(page.locator('#density-sync')).toBeChecked();
  await page.keyboard.press('Escape');
});
