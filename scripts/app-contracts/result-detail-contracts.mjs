import assert from "node:assert/strict";
import { loadModule } from "./runtime.mjs";

export async function assertResultDetails() {
  const { subcladeProfileForClade } = await loadModule("worker/evidence-profile.ts");
  const { annotateProfile } = await loadModule("worker/ancient-evidence.ts");
  const { routeFromUrl, sameHistoryRoute } = await loadModule("app/research-history.ts");
  const { createResearchMarkup } = await loadModule("app/research-markup.ts");
  const { renderProfileMatrix } = await loadModule("app/profile-matrix.ts");
  const { resultDetailScope } = await loadModule("app/result-detail.ts");
  const root = { id: "R-SYN-ROOT", project: "R", formed: 5500, formedKnown: true };
  const child = { id: "R-SYN-CHILD", project: "R", formed: 5000, formedKnown: true };
  const other = { id: "R-SYN-OTHER", project: "R", formed: 4500, formedKnown: true };
  const records = [
    { country: "RUS", count: 2, path: [root] },
    { country: "RUS", count: 4, path: [root, child] },
    { country: "POL", count: 9, path: [root, child] },
    { country: "FRA", count: 7, path: [root, other] },
  ];
  const index = { sampleScope: "all", ancientSampleCount: 12,
    samplesByClade: new Map([[root.id, records], [child.id, records.slice(1, 3)]]),
    signatureIndex: new Map([
      [root.id, { node: root, total: 22, countryCounts: new Map([["RUS", 6], ["POL", 9], ["FRA", 7]]), ancientCountryCounts: new Map([["RUS", 3], ["POL", 4], ["FRA", 5]]) }],
      [child.id, { node: child, total: 13, countryCounts: new Map([["RUS", 4], ["POL", 9]]), ancientCountryCounts: new Map([["RUS", 1], ["POL", 4]]) }],
    ]) };
  const scoped = annotateProfile(index, subcladeProfileForClade(index, root.id, ["RUS"]));
  assert.equal(scoped.total, 6, "details retain the result's samples, not all 22 profile records");
  assert.equal(scoped.directTotal, 2);
  assert.equal(scoped.ancientTotal, 3);
  assert.deepEqual([...scoped.countryCounts], [["RUS", 6]]);
  assert.equal(scoped.immediateBranches.length, 1, "unselected-country-only branches do not enter the details");
  assert.equal(scoped.immediateBranches[0].total, 4);
  assert.equal(scoped.immediateBranches[0].ancientTotal, 1);
  assert.equal(scoped.evidenceTree.children[0].ancientTotal, 1);
  assert.equal(subcladeProfileForClade(index, root.id).total, 22, "standalone profile is unchanged");
  assert.equal(subcladeProfileForClade(index, root.id, []), null, "empty scope cannot expand to all countries");
  assert.equal(subcladeProfileForClade(index, child.id, ["RUS"]).total, 4, "Crossing samples belong to the child, not its parent's six records");
  assert.equal(subcladeProfileForClade(index, root.id, ["RUS", "POL"]).total, 15, "countries below the common minimum still count");
  const row = { node: root, crossingChild: child, countryCounts: new Map([["RUS", 4]]) };
  const scope = resultDetailScope(row);
  assert.deepEqual(scope, { mode: "crossing", countries: ["RUS"], parentId: root.id });
  const route = routeFromUrl(new URL(`https://example.test/?view=profile&clade=${child.id}&detail=crossing&scope=RUS&edge=${root.id}`));
  assert.deepEqual(route, { view: "profile", clade: child.id, detail: scope });
  assert.equal(sameHistoryRoute(route, { view: "profile", clade: child.id }), false, "full and scoped profiles cannot share a cached response");
  assert.deepEqual(routeFromUrl(new URL("https://example.test/?view=profile&clade=R-SYN-ROOT&detail=formed")), { view: "time" });
  const options = { t: key => key, formatNumber: String, formatCalendar: String, countryName: String,
    countryFlag: () => "", subcladeUrl: id => `https://example.test/${id}`, resultDetail: () => scope, terminal: () => true };
  const markup = createResearchMarkup(options, () => 200);
  const html = markup.profile(scoped) + markup.profileInspector(scoped.evidenceTree.children[0], false)
    + renderProfileMatrix(scoped, 20, 0, options);
  assert.doesNotMatch(html, /data-open-profile-subclade|data-country-evidence=|data-search-profile-formed|href=/,
    "terminal details have no onward navigation");
  assert.match(html, /data-profile-select/, "local tree inspection remains available");
}
