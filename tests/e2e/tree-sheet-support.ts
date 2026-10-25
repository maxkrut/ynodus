import { expect, type Page } from '@playwright/test';

export async function collectWholeTree(page: Page, parent: string): Promise<string[]> {
  const more = page.locator(`[data-evidence-tree-more="${parent}"]`);
  for (let i = 0; await more.count(); i++) {
    expect(i).toBeLessThan(1000);
    await more.click();
  }
  const ids = new Set<string>();
  for (let i = 0; ; i++) {
    expect(i).toBeLessThan(1000);
    expect(await page.locator('.tree-sheet tbody tr:not(.tree-context-row)').count()).toBeLessThanOrEqual(100);
    for (const id of await page.locator('[data-tree-node]').evaluateAll(rows => rows.map(row => row.getAttribute('data-tree-node')!))) ids.add(id);
    const next = page.locator('[data-evidence-tree-page="next"]');
    if (await next.isDisabled()) break;
    await next.focus(); await next.press('Enter');
  }
  return [...ids];
}
