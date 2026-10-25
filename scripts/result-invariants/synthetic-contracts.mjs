import assert from "node:assert/strict";
import { independentCrossingCompact, syntheticIndex } from "./synthetic-fixtures.mjs";

export function assertSyntheticSemantics(
  buildIndex,
  collectRowsAtTarget,
  collectTimeMatchResults,
  formedCoverageNodeIds,
  crossingEdgeCoveredByFormed,
  resetCaches,
  subcladeProfileForClade,
  countryEvidenceForBranch,
) {
  const compact = syntheticIndex();
  assert.throws(
    () => buildIndex({
      ...compact,
      format: "ytree-time-lens/hras-index-v2",
      formatVersion: 2,
    }),
    /Unsupported HRAS index format/,
    "legacy compact-index schemas must fail closed",
  );
  assert.throws(
    () => buildIndex({
      ...compact,
      nodes: compact.nodes.map((node, index) => index === 0 ? [...node, 6500, 0] : node),
    }),
    /must contain exactly 3 values/,
    "v3 nodes must remain exact project/parent/formed tuples",
  );
  const sourceParentById = compactParentMap(compact);
  const index = buildIndex(compact);
  assert.equal(
    index.samplesByClade.get("R-ALL")?.length,
    index.samples.length,
    "the clade evidence index must retain every supporting record for a root branch",
  );
  assert.ok(
    (index.samplesByClade.get("R-AA")?.length ?? 0) < index.samples.length,
    "a lower branch profile must be able to inspect its own records without scanning the full snapshot",
  );
  const profile = subcladeProfileForClade(index, "R-ALL");
  assert.ok(profile, "a supported local-snapshot clade must have a profile");
  assert.equal(profile.total, 8);
  assert.equal(profile.directTotal, 0);
  assert.deepEqual(
    profile.immediateBranches.map((branch) => [branch.node.id, branch.total]),
    [["R-AA", 5], ["R-CHILD", 3]],
    "profile evidence must partition records by one immediate child without double-counting",
  );
  assert.equal(
    profile.directTotal + profile.immediateBranches.reduce((sum, branch) => sum + branch.total, 0),
    profile.total,
    "profile direct evidence and immediate children must partition subtree support exactly once",
  );
  assert.equal(profile.supportedDescendantCount, 3);
  assert.equal(profile.datedDescendantCount, 3);
  assert.equal(profile.path.at(-1).id, "R-ALL");

  const countryEvidence = countryEvidenceForBranch(index, "BB", "R-ALL");
  assert.ok(countryEvidence, "country evidence must be available inside a supported branch");
  assert.equal(countryEvidence.total, 6);
  assert.equal(countryEvidence.directTotal, 0);
  assert.deepEqual(
    countryEvidence.immediateBranches.map((branch) => [branch.node.id, branch.total]),
    [["R-AA", 3], ["R-CHILD", 3]],
  );
  assert.equal(
    countryEvidence.directTotal + countryEvidence.immediateBranches.reduce((sum, branch) => sum + branch.total, 0),
    countryEvidence.total,
    "one-level country partition must account for each in-scope sample exactly once",
  );
  assert.equal(
    countryEvidence.deepestAssignments.reduce((sum, assignment) => sum + assignment.total, 0),
    countryEvidence.total,
    "terminal assignments must be an alternative partition of the same evidence",
  );
  assert.equal(subcladeProfileForClade(index, "R-MISSING"), null);
  assert.equal(countryEvidenceForBranch(index, "ZZ", "R-ALL"), null);
  resetCaches();
  const base = {
    target: 5000,
    selectedCountries: ["AA", "BB"],
    maxDeltaYbp: 100,
    minSamples: 0,
    anchorId: null,
    scopeAllCountries: false,
    includeSuggestions: false,
  };
  const formedAny = collectRowsAtTarget(index, { ...base, sliceMode: "formed", presenceMode: "any" });
  const formedAll = collectRowsAtTarget(index, { ...base, sliceMode: "formed", presenceMode: "all" });
  assert.deepEqual(formedAny.rows.map((row) => row.node.id), ["R-ALL"]);
  assert.deepEqual(formedAll.rows.map((row) => row.node.id), ["R-ALL"]);
  assert.deepEqual(formedAny.rows[0].formedMembers.map((member) => member.node.id), ["R-ALL"]);
  assert.equal(formedAny.rows[0].total, 8);
  assert.deepEqual([...formedAny.rows[0].countryCounts], [["AA", 2], ["BB", 6]]);
  assert.ok(
    formedAny.rows[0].path.some((node) => node.id === "R-UNKNOWN" && node.formedKnown === false),
    "unknown-date source node must stay in the contiguous result path",
  );
  assertRealPath(sourceParentById, formedAny.rows[0].path);
  assert.equal(formedAny.rows.some((row) => row.node.id === "R-UNKNOWN"), false);
  assert.equal(formedAny.densityRows.some((row) => row.node.id === "R-UNKNOWN"), false);

  const sameDated = collectRowsAtTarget(index, {
    ...base,
    target: 4000,
    maxDeltaYbp: 0,
    sliceMode: "formed",
    presenceMode: "any",
  });
  assert.deepEqual(
    sameDated.rows.map((row) => row.node.id),
    ["R-AA", "R-CHILD"],
    "connected same-date members must collapse while an unrelated branch stays separate",
  );
  assert.deepEqual(
    sameDated.rows[0].formedMembers.map((member) => member.node.id),
    ["R-AA", "R-AA-CHILD"],
  );
  assert.equal(sameDated.rows[0].total, 5,
    "a sample supporting both parent and child must count once in the Formed group");
  assert.deepEqual([...sameDated.rows[0].countryCounts], [["AA", 2], ["BB", 3]]);
  assert.deepEqual(sameDated.rows[1].formedMembers.map((member) => member.node.id), ["R-CHILD"]);

  const connectedBranch = collectRowsAtTarget(index, {
    ...base,
    target: 4500,
    maxDeltaYbp: 600,
    sliceMode: "formed",
    presenceMode: "any",
  });
  assert.deepEqual(connectedBranch.rows.map((row) => row.node.id), ["R-ALL"],
    "connected dated events inside Hit must become one upper branch result");
  assert.deepEqual(
    connectedBranch.rows[0].formedEvents.map((event) => ({
      node: event.node.id,
      members: event.formedMembers.map((member) => member.node.id),
      total: event.total,
      parent: event.parentEventId,
      via: event.viaParentId,
    })),
    [
      { node: "R-ALL", members: ["R-ALL"], total: 8, parent: null, via: null },
      { node: "R-AA", members: ["R-AA", "R-AA-CHILD"], total: 5, parent: "R-ALL", via: "R-ALL" },
      { node: "R-CHILD", members: ["R-CHILD"], total: 3, parent: "R-ALL", via: "R-ALL" },
    ],
    "branch details must preserve same-date grouping, siblings, support and real connecting parents",
  );
  assert.equal(connectedBranch.rows[0].total, 8,
    "nested event totals must not be added to upper branch support");
  assert.equal(connectedBranch.matchingSamples, 8,
    "matching support must count samples at the upper branch once");
  assert.deepEqual(connectedBranch.rows[0].formedSpan, { olderYbp: 5000, youngerYbp: 4000 });
  assert.deepEqual(connectedBranch.rows[0].deltaRange, { minYbp: 500, maxYbp: 500 });

  const connectedBranchEvery = collectRowsAtTarget(index, {
    ...base,
    target: 4500,
    maxDeltaYbp: 600,
    sliceMode: "formed",
    presenceMode: "all",
  });
  assert.deepEqual(
    connectedBranchEvery.rows[0].formedEvents.map((event) => event.node.id),
    ["R-ALL", "R-AA"],
    "Every country must filter nested events before branch aggregation",
  );
  const sameDatedEvery = collectRowsAtTarget(index, {
    ...base,
    target: 4000,
    maxDeltaYbp: 0,
    sliceMode: "formed",
    presenceMode: "all",
  });
  assert.deepEqual(sameDatedEvery.rows.map((row) => row.node.id), ["R-AA"],
    "Every country must be applied to aggregated group evidence");
  const sameDatedCrossing = collectRowsAtTarget(index, {
    ...base,
    target: 4000,
    sliceMode: "crossing",
    presenceMode: "any",
  });
  assert.ok(
    sameDatedCrossing.rows.some((row) => row.node.id === "R-ALL" && row.crossingChild.id === "R-CHILD"),
    "a real edge ending exactly at target remains a Crossing result",
  );

  const strictMin = collectRowsAtTarget(index, {
    ...base,
    sliceMode: "formed",
    presenceMode: "any",
    minSamples: 3,
  });
  assert.deepEqual(strictMin.rows.map((row) => row.node.id), ["R-ALL"]);
  assert.equal(strictMin.matchingSamples, 8);
  assert.deepEqual([...strictMin.rows[0].countryCounts], [["AA", 2], ["BB", 6]]);

  const impossibleNeighbor = collectRowsAtTarget(index, {
    ...base,
    target: 6000,
    maxDeltaYbp: 0,
    minSamples: 9,
    includeSuggestions: true,
    sliceMode: "formed",
    presenceMode: "any",
  });
  assert.deepEqual(impossibleNeighbor.rows, []);
  assert.deepEqual(impossibleNeighbor.suggestions, { older: 7000, younger: 5000 },
    "All branches suggestions ignore the minimum, like their results");

  const eligibleNeighbor = collectRowsAtTarget(index, {
    ...base,
    target: 6000,
    maxDeltaYbp: 0,
    minSamples: 6,
    includeSuggestions: true,
    sliceMode: "formed",
    presenceMode: "any",
  });
  assert.deepEqual(eligibleNeighbor.suggestions, { older: 7000, younger: 5000 },
    "nearest-date suggestions must retain candidates that satisfy Min samples");

  const crossing = collectRowsAtTarget(index, {
    ...base,
    target: 4500,
    sliceMode: "crossing",
    presenceMode: "any",
  });
  assert.deepEqual(
    crossing.rows.map((row) => `${row.node.id}>${row.crossingChild.id}`),
    ["R-ALL>R-AA", "R-ALL>R-CHILD"],
  );
  assert.equal(
    crossing.rows.some((row) => row.node.id === "R-UNKNOWN" || row.crossingChild.id === "R-UNKNOWN"),
    false,
  );
  const coveredBranch = collectTimeMatchResults(index, {
    ...base,
    target: 4500,
    maxDeltaYbp: 600,
    presenceMode: "any",
    includeCrossing: true,
  });
  assert.deepEqual(coveredBranch.formed.rows.map((row) => row.node.id), ["R-ALL"]);
  assert.deepEqual(
    coveredBranch.crossing.rows,
    [],
    "Crossing must omit edges whose parent or child is already a Formed identity or same-date member",
  );
  assert.equal(coveredBranch.crossing.matchingSamples, 0);

  const anchored = collectRowsAtTarget(index, {
    ...base,
    selectedCountries: [],
    scopeAllCountries: true,
    anchorId: "R-ALL",
    sliceMode: "formed",
    presenceMode: "all",
  });
  assert.deepEqual(anchored.rows.map((row) => row.node.id), ["R-ALL"]);
  assert.ok(anchored.rows.every((row) => row.path[0].id === "R-ROOT"));

  const invertCompact = {
    ...syntheticIndex(),
    nodeIds: ["P", "C"],
    nodeCount: 2,
    sampleCount: 1,
    hrasManifestSampleCount: 1,
    countryCodes: ["AA"],
    countryCounts: [1],
    nodes: [
      [0, -1, 3000],
      [0, 0, 6000],
    ],
    samples: [[1, 0, 1]],
  };
  resetCaches();
  const invert = collectRowsAtTarget(buildIndex(invertCompact), {
    target: 4500,
    selectedCountries: ["AA"],
    maxDeltaYbp: 50,
    minSamples: 0,
    anchorId: null,
    scopeAllCountries: false,
    includeSuggestions: false,
    sliceMode: "crossing",
    presenceMode: "any",
  });
  assert.equal(invert.rows.length, 1);
  assert.equal(invert.rows[0].node.id, "P");
  assert.equal(invert.rows[0].crossingChild.id, "C");
  assert.equal(invert.rows[0].node.formed, 3000);
  assert.equal(invert.rows[0].crossingChild.formed, 6000);
  assert.ok(
    invert.rows[0].node.formed < invert.rows[0].crossingChild.formed,
    "inverted source dates must remain in source order",
  );

  resetCaches();
  const noveltyIndex = buildIndex(independentCrossingCompact());
  const unfilteredNovel = collectRowsAtTarget(noveltyIndex, {
    target: 4500,
    selectedCountries: ["AA"],
    maxDeltaYbp: 0,
    minSamples: 0,
    anchorId: null,
    scopeAllCountries: false,
    includeSuggestions: false,
    sliceMode: "crossing",
    presenceMode: "any",
  });
  assert.deepEqual(
    unfilteredNovel.rows.map((row) => `${row.node.id}>${row.crossingChild.id}`),
    ["ROOT>FORMED", "NEW_P>NEW_C", "FORMED>COVERED_CHILD"],
  );
  const novelMatch = collectTimeMatchResults(noveltyIndex, {
    target: 4500,
    selectedCountries: ["AA"],
    maxDeltaYbp: 0,
    minSamples: 0,
    anchorId: null,
    scopeAllCountries: false,
    includeSuggestions: false,
    presenceMode: "any",
    includeCrossing: true,
  });
  assert.deepEqual(novelMatch.formed.rows.map((row) => row.node.id), ["FORMED"]);
  assert.deepEqual(
    formedCoverageNodeIds(novelMatch.formed.rows).sort(),
    ["FORMED"],
  );
  assert.deepEqual(
    novelMatch.crossing.rows.map((row) => `${row.node.id}>${row.crossingChild.id}`),
    ["NEW_P>NEW_C"],
    "an independent long edge must remain after Formed-covered Crossing edges are omitted",
  );
  assert.equal(novelMatch.crossing.matchingSamples, 3);
  assert.equal(
    crossingEdgeCoveredByFormed(unfilteredNovel.rows.find((row) => row.crossingChild.id === "FORMED"), new Set(["FORMED"])),
    true,
  );
  assert.equal(
    crossingEdgeCoveredByFormed(novelMatch.crossing.rows[0], new Set(formedCoverageNodeIds(novelMatch.formed.rows))),
    false,
  );

  assert.throws(
    () => buildIndex({ ...compact, sourceUrl: "" }),
    /sourceUrl/,
    "missing provenance URLs must fail closed",
  );
  assert.throws(
    () => buildIndex({ ...compact, sourceUrl: "http://hras.example.test/" }),
    /sourceUrl/,
    "insecure provenance URLs must fail closed",
  );
  assert.throws(
    () => buildIndex({ ...compact, sourceManifestUrl: "not a URL" }),
    /sourceManifestUrl/,
    "malformed provenance URLs must fail closed",
  );
  assert.throws(
    () => buildIndex({ ...compact, treeVersion: "unknown" }),
    /treeVersion/,
    "unknown HRAS version markers must fail closed at runtime",
  );
  assert.throws(
    () => buildIndex({ ...compact, treeOfficialVersion: "unknown" }),
    /treeOfficialVersion/,
    "unknown reference version markers must fail closed at runtime",
  );
  assert.throws(
    () => buildIndex({ ...compact, computedDate: "not-a-date" }),
    /computedDate/,
    "unparseable HRAS dates must fail closed at runtime",
  );
  assert.throws(
    () => buildIndex({ ...compact, hrasManifestSampleCount: null }),
    /hrasManifestSampleCount/,
    "missing manifest sample counts must fail closed at runtime",
  );
}

function assertRealPath(sourceParentById, nodes) {
  for (let position = 0; position < nodes.length; position += 1) {
    const sourceParent = sourceParentById.get(nodes[position].id);
    assert.notEqual(sourceParent, undefined, `path node ${nodes[position].id} is absent from the source index`);
    if (position === 0) continue;
    assert.equal(sourceParent, nodes[position - 1].id, `non-parent-child path edge at ${nodes[position].id}`);
  }
}

function compactParentMap(compact) {
  return new Map(compact.nodeIds.map((id, index) => {
    const parentIndex = compact.nodes[index][1];
    return [id, parentIndex >= 0 ? compact.nodeIds[parentIndex] : null];
  }));
}
