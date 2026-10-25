import assert from "node:assert/strict";

export function assertCrossingNoveltyOnDefaultQuery(
  index,
  presetScopes,
  collectRowsAtTarget,
  collectTimeMatchResults,
  formedCoverageNodeIds,
  crossingEdgeCoveredByFormed,
) {
  const slavic = presetScopes.find((preset) => preset.key === "slavic");
  assert.ok(slavic, "slavic preset must exist for the default Crossing-novelty check");
  const shared = {
    target: 5450,
    selectedCountries: slavic.countries,
    presenceMode: "all",
    maxDeltaYbp: 300,
    minSamples: 5,
    anchorId: null,
    scopeAllCountries: false,
    includeSuggestions: false,
  };
  const { formed, crossing } = collectTimeMatchResults(index, {
    ...shared,
    includeCrossing: true,
  });
  assert.ok(crossing, "optional Crossing must be computed with Formed in one committed response");
  const covered = new Set(formedCoverageNodeIds(formed.rows));
  for (const row of crossing.rows) {
    assert.equal(
      crossingEdgeCoveredByFormed(row, covered),
      false,
      `${row.node.id}>${row.crossingChild.id} still overlaps a Formed identity or same-date member`,
    );
  }
  const unfiltered = collectRowsAtTarget(index, { ...shared, sliceMode: "crossing" });
  const novelIds = new Set(crossing.rows.map((row) => `${row.node.id}>${row.crossingChild.id}`));
  for (const row of unfiltered.rows) {
    const id = `${row.node.id}>${row.crossingChild.id}`;
    assert.equal(
      novelIds.has(id),
      !crossingEdgeCoveredByFormed(row, covered),
      `${id} novelty must match the committed Crossing table`,
    );
  }
}
