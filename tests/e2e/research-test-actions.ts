import {expect,type Page} from '@playwright/test';

/** Tests of deep evidence opt into the full hierarchy; initial compact states have separate coverage. */
export async function allResearchLevels(page:Page) {
  const control=page.locator('[data-research-expand]:visible');
  await expect(control).toBeVisible();
  await control.click();
}
