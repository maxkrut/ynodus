import assert from "node:assert/strict";
import { compact } from "../semantic-audit/fixtures.mjs";

export function eligibleCountries(index, input) {
  if (input.presenceMode === "any" || input.minSamples === 0) return input.selectedCountries;
  return input.selectedCountries.filter(code => {
    let count = 0;
    for (const sample of index.samplesByCountry.get(code) ?? []) {
      const candidate = sample.path.some((node, i) => {
        if (node.formedKnown === false) return false;
        if (input.sliceMode === "formed") return Math.abs(node.formed - input.target) <= input.maxDeltaYbp;
        const child = sample.path[i + 1];
        return child && child.formedKnown !== false
          && input.target >= Math.min(node.formed, child.formed) && input.target <= Math.max(node.formed, child.formed);
      });
      if (candidate) count += sample.count;
    }
    return count >= Math.max(1, input.minSamples);
  });
}

export function assertCountryMinimum(buildIndex, collect, combined) {
  const data = compact([-1, 0, 1], [12000, 8600, 8600], [[1, 0, 2], [2, 0, 3], [2, 1, 4]]);
  const index = buildIndex(data);
  const query = { target: 8600, selectedCountries: ["AAA", "BBB"], presenceMode: "all",
    sliceMode: "formed", maxDeltaYbp: 0, minSamples: 5, anchorId: null,
    scopeAllCountries: false, includeSuggestions: true };
  const result = collect(index, query);
  assert.deepEqual(result.participatingCountries, ["AAA"]);
  assert.deepEqual(collect(index, { ...query, minSamples: 1 }).participatingCountries, ["AAA", "BBB"]);
  assert.equal(result.rows.length, 1, "split evidence reaches the threshold once, without adding nested totals");
  assert.equal(result.rows[0].formedMembers.length, 2);
  assert.deepEqual([...result.rows[0].countryCounts], [["AAA", 5], ["BBB", 4]]);
  assert.deepEqual([...result.rows[0].belowMinimumCountryCounts], [["BBB", 4]]);
  assert.equal(result.rows[0].total, 9);
  assert.equal(result.matchingSamples, 9);
  assert.equal(collect(index, { ...query, minSamples: 6 }).matchingSamples, 0);
  assert.equal(collect(index, { ...query, minSamples: 0 }).matchingSamples, 9);
  assert.equal(collect(index, { ...query, minSamples: 1 }).rows[0].belowMinimumCountryCounts, undefined);
  assert.equal(collect(index, { ...query, presenceMode: "any", minSamples: 999 }).matchingSamples, 9,
    "all-branches mode ignores the minimum entirely");
  assert.equal(collect(index, { ...query, presenceMode: "any" }).rows[0].belowMinimumCountryCounts, undefined);
  assert.deepEqual(collect(index, { ...query, target: 8500, minSamples: 6 }).suggestions,
    { older: null, younger: null });
  assert.deepEqual(collect(index, { ...query, target: 8500 }).suggestions, { older: 8600, younger: null });
  assert.deepEqual(collect(index, { ...query, target: 8500, presenceMode: "any", minSamples: 999 }).suggestions,
    { older: 8600, younger: null });
  assert.equal(result.densityRows.length, 3, "same-age members use their canonical group's evidence");
  const cached = collect(index, { ...query, minSamples: 2 });
  assert.notEqual(collect(index, { ...query, minSamples: 3, knownDensityKey: cached.densityKey }).densityRows, null);
  assert.notEqual(collect(index, { ...query, target: 8500, minSamples: 2, knownDensityKey: cached.densityKey }).densityRows, null,
    "date changes may change the participating country set");
  const allBranches = collect(index, { ...query, presenceMode: "any", minSamples: 2 });
  assert.equal(collect(index, { ...query, presenceMode: "any", minSamples: 999, knownDensityKey: allBranches.densityKey }).densityRows, null,
    "the ignored minimum cannot invalidate the all-branches context");

  const example = buildIndex(compact([-1, 0, 0], [18000, 8600, 8600],
    [[1, 0, 50], [1, 1, 2], [2, 0, 2], [2, 1, 1]]));
  const exampleQuery = { ...query, selectedCountries: ["AAA", "BBB", "CCC"] };
  const strict = collect(example, { ...exampleQuery, minSamples: 0 });
  assert.deepEqual(strict.participatingCountries, ["AAA", "BBB", "CCC"]);
  assert.deepEqual(strict.rows, [], "zero requires the absent selected country too");
  assert.equal(strict.matchingSamples, 0);
  assert.deepEqual(strict.densityRows, [], "density follows the same strict country condition");
  assert.equal(strict.countryMinimumNotMet, false, "zero does not request a threshold change");
  const relaxed = collect(example, { ...exampleQuery, minSamples: 1, knownDensityKey: strict.densityKey });
  assert.equal(relaxed.rows.length, 2, "positive thresholds retain the temporal-pool rule");
  assert.notEqual(relaxed.densityKey, strict.densityKey, "zero and one cannot share cached density");
  assert.notEqual(relaxed.densityRows, null);
  const shown = collect(example, exampleQuery);
  assert.equal(shown.rows.length, 2, "50 + 2 + absent country qualifies; the sparse country cannot restrict other branches");
  const main = shown.rows.find(row => row.countryCounts.get("AAA") === 50);
  assert.equal(main.total, 52);
  assert.deepEqual([...main.belowMinimumCountryCounts], [["BBB", 2]]);
  assert.equal(shown.matchingSamples, 55);
  const unfiltered = collect(example, { ...exampleQuery, presenceMode: "any", minSamples: 999999 });
  assert.equal(unfiltered.rows.length, 2, "all-branches mode includes the 2 + 1 branch too");
  assert.equal(unfiltered.matchingSamples, 55);
  assert.ok(unfiltered.rows.every(row => row.belowMinimumCountryCounts === undefined));
  assert.equal(collect(example, { ...exampleQuery, selectedCountries: ["BBB"] }).rows.length, 0);
  const single = { ...exampleQuery, selectedCountries: ["BBB"] };
  const failedSingle = collect(example, single);
  assert.equal(failedSingle.countryMinimumNotMet, true, "the UI can explain the sole country's failed minimum");
  assert.equal(collect(example, { ...single, knownDensityKey: failedSingle.densityKey }).countryMinimumNotMet, true);
  assert.equal(collect(example, { ...single, minSamples: 3 }).countryMinimumNotMet, false,
    "the exact temporal-pool minimum is retained");
  assert.equal(collect(example, { ...single, target: 1000, minSamples: 0 }).countryMinimumNotMet, false,
    "zero keeps the selected country even when its temporal support is absent");
  assert.equal(collect(example, { ...single, presenceMode: "any" }).countryMinimumNotMet, false);
  assert.equal(collect(example, { ...exampleQuery, minSamples: 999 }).countryMinimumNotMet, true,
    "no qualifying countries requests a reset regardless of selection size");
  assert.equal(collect(example, exampleQuery).countryMinimumNotMet, false,
    "one qualifying country keeps Common branches for a larger selection");
  assert.equal(collect(example, { ...exampleQuery, selectedCountries: [] }).countryMinimumNotMet, false,
    "an empty selection never requests an automatic reset");
  const sparseCountries = buildIndex(compact([-1, -1], [8600, 8600], [[0, 0, 3], [1, 1, 2]]));
  assert.equal(collect(sparseCountries, query).countryMinimumNotMet, true,
    "3 + 2 across countries cannot satisfy a minimum of 5 for either country");
  assert.equal(collect(sparseCountries, { ...query, presenceMode: "any" }).rows.length, 2);
  const disjointCountries = buildIndex(compact([-1, -1], [8600, 8600], [[0, 0, 5], [1, 1, 5]]));
  const disjoint = collect(disjointCountries, query);
  assert.equal(disjoint.rows.length, 0);
  assert.equal(disjoint.countryMinimumNotMet, false,
    "countries reaching the minimum keep Common mode even when no branch is shared");
  assert.equal(collect(example, { ...exampleQuery, selectedCountries: ["BBB"], presenceMode: "any" }).rows.length, 2);
  assert.equal(collect(example, { ...exampleQuery, minSamples: 53 }).rows.length, 0);
  assert.equal(collect(index, { ...query, target: 10000, maxDeltaYbp: 3000, minSamples: 6 }).rows.length, 0,
    "one record supporting several dated ancestors counts only once in the temporal cohort");

  const spreadData = compact([-1, 0, 0, 0, 0], [18000, 8600, 8600, 8600, 3000],
    [[1, 0, 50], [1, 1, 2], [2, 0, 2], [3, 1, 4], [4, 2, 100]]);
  const spread = buildIndex(spreadData);
  const spreadResult = collect(spread, exampleQuery);
  assert.equal(spreadResult.rows.length, 1, "both countries reach 5 across different branches, so their intersection is required");
  assert.equal(spreadResult.rows[0].total, 52);
  assert.equal(spreadResult.rows[0].belowMinimumCountryCounts, undefined,
    "a country with 2 records in this row stays active when it has 6 in the temporal pool");
  assert.equal(collect(spread, { ...exampleQuery, target: 3000 }).rows[0].countryCounts.get("CCC"), 100);

  const crossingIndex = buildIndex(compact([-1, 0], [18000, 7000], [[1, 0, 8], [1, 1, 3]]));
  const crossingQuery = { ...query, target: 10000, includeCrossing: true };
  const crossing = combined(crossingIndex, crossingQuery);
  assert.deepEqual(crossing.formed.participatingCountries, []);
  assert.deepEqual(crossing.crossing.participatingCountries, ["AAA"], "Crossing has its own temporal country pool");
  assert.deepEqual(crossing.formed.rows, []);
  assert.equal(crossing.crossing.rows[0].total, 11);
  assert.deepEqual([...crossing.crossing.rows[0].belowMinimumCountryCounts], [["BBB", 3]]);
  assert.equal(combined(crossingIndex, { ...crossingQuery, minSamples: 9 }).crossing.rows.length, 0);
  const anyCrossing = combined(crossingIndex, { ...crossingQuery, presenceMode: "any", minSamples: 999 });
  assert.equal(anyCrossing.crossing.rows[0].total, 11);
  assert.equal(anyCrossing.crossing.rows[0].belowMinimumCountryCounts, undefined);
  assert.deepEqual(combined(index, { ...query, includeCrossing: true }).crossing.rows, []);
  const strictCrossing = combined(crossingIndex, { ...crossingQuery, minSamples: 0,
    selectedCountries: ["AAA", "BBB", "CCC"] });
  assert.deepEqual(strictCrossing.crossing.rows, [], "strict country intersection also applies to Crossing");
  assert.deepEqual(strictCrossing.crossing.participatingCountries, ["AAA", "BBB", "CCC"]);
}
