import {expect,test} from '@playwright/test';
import {startAudit,capture,fit} from './visual-audit-support';
import {layoutFixture,layoutQuery} from '../fixtures/layout.mjs';

for(const width of [320,1440]) for(const lang of ['ru','en']){
  test(`load failure, diagnostics and retry restore a usable page: ${lang} ${width}`,async({page})=>{
    await page.setViewportSize({width,height:1000});let fail=true;
    await page.route('**/data/hras-index.json',route=>fail
      ?route.fulfill({status:503,contentType:'text/html',body:'Synthetic unavailable source'})
      :route.fulfill({json:layoutFixture()}));
    await page.goto(layoutQuery.replace('lang=ru','lang='+lang));
    const retry=page.locator('[data-retry-load]');await expect(retry).toBeVisible();
    await expect(page.locator('#export-csv')).toBeDisabled();
    await page.locator('.error-diagnostics > summary').click();
    await capture(page,`load-error-${lang}-${width}`);
    fail=false;await retry.click();
    await expect(page.locator('#export-csv')).toBeEnabled();
    await expect(page.locator('#result-body [data-open-result-detail]')).not.toHaveCount(0);
    expect(new URL(page.url()).searchParams.get('lang')).toBe(lang);await fit(page);
  });

  test(`numeric drafts, recovery, era boundaries and sample scope: ${lang} ${width}`,async({page})=>{
    await startAudit(page,width,lang);
    for(const selector of ['#target-year','#max-delta-ybp']){
      const input=page.locator(selector),value=await input.inputValue();
      await input.fill('');await expect(page.locator('#export-csv')).toBeDisabled();
      await expect(page.locator('#target-density')).toHaveAttribute('aria-busy','true');
      await input.fill(value);await expect(page.locator('#export-csv')).toBeEnabled();
    }
    await page.evaluate(()=>(window as any).audit.hold=true);
    const date=page.locator('#target-year');await date.fill(String(Number(await date.inputValue())+1));
    await expect(page.locator('#target-density')).toHaveAttribute('aria-busy','true');
    await expect(page.locator('#export-csv')).toBeDisabled();
    await expect.poll(()=>page.evaluate(()=>(window as any).audit.held.length)).toBeGreaterThan(0);
    await page.evaluate(()=>{const a=(window as any).audit;a.hold=false;a.held.splice(0).forEach(send=>send());});
    await expect(page.locator('#export-csv')).toBeEnabled();
    await page.locator('#target-year').fill('0');await page.locator('#density-step').focus();
    await expect(page.locator('#target-year')).toHaveValue('1');
    await page.locator('#target-era [data-era="CE"]').click();
    await expect(page.locator('#target-era')).toHaveAttribute('value','CE');
    await page.locator('#target-year').fill('9999999');
    await expect(page.locator('#target-year')).toHaveValue('1950');
    await expect(page.locator('#live-status')).toHaveAttribute('data-busy','false');
    for(const scope of ['modern','ancient','all']){
      await page.locator('#sample-scope').selectOption(scope);
      await expect(page.locator('#sample-scope')).toHaveValue(scope);
      await expect(page.locator('#live-status')).toHaveAttribute('data-busy','false');
      const sampleUrl=new URL(page.url()).searchParams.get('samples');
      expect(sampleUrl??'all').toBe(scope);
    }
    await page.locator('.research-entrypoints [data-research-view="profile"]').click();
    await page.locator('#profile-clade-search').fill('R-SYN-100');
    await page.locator('#profile-lookup button[type="submit"]').click();
    await expect(page.locator('.profile-compact-header h3')).toHaveText('R-SYN-100');
    await page.locator('#profile-clade-search').fill('R-SYN-MISSING');
    await page.locator('#profile-lookup button[type="submit"]').click();
    await expect(page.locator('#profile-clade-search')).toHaveAttribute('aria-invalid','true');
    await expect(page.locator('#profile-lookup-status')).not.toBeEmpty();
    await expect(page.locator('.profile-compact-header h3')).toHaveText('R-SYN-100');
    await capture(page,`missing-clade-${lang}-${width}`,'#profile-workspace');
    await page.locator('#profile-clade-search').fill('R-SYN-ROOT');
    await page.locator('#profile-lookup button[type="submit"]').click();
    await expect(page.locator('.profile-compact-header h3')).toHaveText('R-SYN-ROOT');
    await expect(page.locator('#profile-clade-search')).toHaveAttribute('aria-invalid','false');
    await fit(page);
  });
}
