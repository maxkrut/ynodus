import assert from "node:assert/strict";
import { compact, query } from "../semantic-audit/fixtures.mjs";
import { parseAncientIds } from "../ancient-samples.mjs";

export function assertAncientScopes(buildIndex, collect, profile, overview, decorators) {
  assert.deepEqual([...parseAncientIds("SYN-A,R-SYN,1,2,3,4000,AAA,R\n")], ["SYN-A"]);
  assert.throws(() => parseAncientIds("invalid"));
  const data = compact([-1, 0, 0], [6000, 5000, 3000], [[0, 0, 5], [1, 0, 4], [1, 1, 6], [2, 1, 5]]);
  data.ancientCounts = [1, 2, 3, 1];
  const totals = { all: 20, modern: 13, ancient: 7 };
  for (const scope of ["all", "modern", "ancient"]) {
    const index = buildIndex(data, scope);
    assert.equal(index.sampleCount, totals[scope]);
    const result = collect(index, query({ target: 6000 }));
    decorators.annotateTime(index, result);
    assert.equal(result.formed.rows[0].total, totals[scope]);
    assert.equal(result.formed.rows[0].ancientTotal, scope === "all" ? 7 : undefined);
    const branch = decorators.annotateProfile(index, profile(index, "SYN-000"));
    assert.equal(branch.total, totals[scope]);
    const comparison = decorators.annotateOverview(index, overview(index,"AAA",["BBB","AAA","BBB"]));
    assert.equal(comparison.total,totals[scope]);
    assert.equal([...comparison.countryCounts.values()].reduce((sum,n)=>sum+n,0),totals[scope]);
    assert.equal(comparison.groups.reduce((sum,item)=>sum+item.total,0),totals[scope]);
    assert.equal(comparison.ancientTotal,scope==="all"?7:undefined);
    if(scope==="all")assert.deepEqual([...comparison.roots[0].ancientCountryCounts],[["AAA",3],["BBB",4]]);
    if (scope === "all") {
      assert.equal(branch.ancientTotal, 7);
      assert.equal(branch.evidenceTree.children.reduce((sum, child) => sum + child.ancientTotal, 0), 6);
      const country = decorators.annotateOverview(index, overview(index, "AAA"));
      assert.equal(country.total, 9);
      assert.equal(country.ancientTotal, 3);
      assert.equal(country.groups.reduce((sum, g) => sum + g.ancientTotal, 0), 3);
      const subset = collect(index, query({ target: 6000, selectedCountries: ["AAA"] }));
      decorators.annotateTime(index, subset);
      assert.equal(subset.formed.rows[0].ancientTotal, 3);
      const crossing = collect(index, query({ target: 5500 }));
      decorators.annotateTime(index, crossing);
      assert.equal(crossing.crossing.rows.find(row => row.crossingChild.id === "SYN-001").ancientTotal, 5);
      const tied = buildIndex({ ...data, nodes: data.nodes.map(n => [n[0], n[1], 6000]) });
      const tiedResult = collect(tied, query({ target: 6000 }));
      decorators.annotateTime(tied, tiedResult);
      assert.equal(tiedResult.formed.rows.length, 1);
      assert.equal(tiedResult.formed.rows[0].ancientTotal, 7, "same-age members must not multiply ancient support");
    }
    const threshold = collect(index, query({ target: 6000, presenceMode: "all", minSamples: 5 }));
    assert.equal(threshold.formed.rows.length, scope === "ancient" ? 0 : 1);
  }
  assert.throws(() => buildIndex({ ...data, ancientCounts: [6, 2, 3, 1] }), /ancientCounts/);
  assert.throws(() => buildIndex({ ...data, ancientCounts: [1] }), /ancientCounts/);
  assert.throws(() => buildIndex({ ...data, ancientCounts: undefined }, "ancient"), /unavailable/);
}
