import { expect, test } from '@playwright/test';
import { compact } from '../../scripts/semantic-audit/fixtures.mjs';
import { allResearchLevels } from './research-test-actions';

for (const width of [390, 1440]) test(`profile and result age pairs remain available in branch details at ${width}`, async ({ page }, info) => {
  const data = compact([-1, 0, 1, 1, 3, 0, 5, 0], [5000, 5000, 4500, 4000, 4000, null, null, 5000],
    [[2, 0, 1], [4, 0, 1], [6, 0, 1], [7, 0, 1]]);
  data.nodeIds = ['R-SYN-ROOT', 'R-SYN-A', 'R-SYN-B', 'R-SYN-C', 'R-SYN-D', 'R-SYN-E', 'R-SYN-F', 'R-SYN-G'];
  data.countryCodes = ['RUS']; data.countryCounts = [4];
  await page.setViewportSize({ width, height: 900 });
  await page.route('**/data/hras-index.json', route => route.fulfill({ json: data }));
  const labels = { ru: 'Пары родитель → потомок с одинаковой оценкой', en: 'Parent → child pairs with matching estimates', };
  const explanations = { ru: 'У разных пар оценки могут отличаться', en: 'Different pairs can have different ages', };
  for (const lang of ['ru', 'en'] as const) for (const view of ['profile', 'details']) {
    const query = `/?lang=${lang}&countries=RUS&target=5000&window=100&min=0`;
    await page.goto(query + (view === 'profile' ? '&view=profile&clade=R-SYN-ROOT' : ''));
    if (view === 'details') await page.locator('[data-open-result-detail="R-SYN-ROOT"]').click();
    await expect(page.locator('#profile-content h3').first()).toHaveText('R-SYN-ROOT');
    const extra = page.locator('[data-profile-extra="details"]');
    await expect(extra).not.toHaveAttribute('open', '');
    await expect(page.locator('[data-tree-age-pairs]')).toBeHidden();
    await extra.locator('> summary').click();
    await expect(page.locator('[data-tree-age-pairs]')).toContainText(`${labels[lang]}: 3`);
    // Two pairs are at 5000, one at 4000; the unknown-parent/unknown-child link is excluded.
    await allResearchLevels(page);
    await expect(page.locator('.same-formed-marker')).toHaveCount(0);
    await expect(page.locator('.tree-sheet .same-formed')).toHaveCount(3);
    await expect(page.locator('[data-profile-select="R-SYN-D"]')).toHaveText('R-SYN-D');
    await expect(page.locator('[data-tree-node="R-SYN-D"]')).toHaveAttribute('data-tree-parent','R-SYN-C');
    await expect(page.locator('[data-tree-node="R-SYN-A"]')).toHaveAttribute('data-tree-parent','R-SYN-ROOT');
    await page.locator('[data-annotation="tree-age-pairs"]').click();
    await expect(page.locator('#context-annotation')).toContainText(explanations[lang]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect(await page.locator('#context-annotation').evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `output/profile-age-pairs/${info.project.name}-${view}-${lang}-${width}.png` });
    await page.keyboard.press('Escape');
    await expect(page.locator('#context-annotation')).toBeHidden();
  }
});
