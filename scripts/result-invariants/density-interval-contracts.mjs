import assert from "node:assert/strict";
import { compact } from "../semantic-audit/fixtures.mjs";

export function assertIntervalDensity(build, collect, reset, realIndex, intervals) {
  // Different dates, nested equal-age nodes, an inverted edge and an unknown intermediary.
  const data = compact([-1, 0, 1, 2, 0, -1], [18000, 8000, 8000, 8100, 3000, 3000],
    [[2, 0, 3], [3, 0, 2], [3, 1, 1], [4, 0, 10], [4, 1, 8], [5, 1, 7]]);
  check(build(data), [0, 1, 5, 6, 999], ["AAA", "BBB", "CCC"], intervals, collect, reset);
  data.formedKnown = [true, false, true, true, true, true];
  check(build(data), [5], ["AAA", "BBB"], intervals, collect, reset);
  check(realIndex, [0, 5], ["DZA", "LBY", "MAR", "MRT", "TUN"], intervals, collect, reset);
}

function check(index, minima, countries, grids, collect, reset) {
  reset();
  const base = { target: 3000, selectedCountries: countries, presenceMode: "any", minSamples: 0,
    sliceMode: "formed", maxDeltaYbp: 300, anchorId: null, scopeAllCountries: false, includeSuggestions: false };
  const invalid = collect(index, { ...base, densityIntervals: [] });
  const restored = collect(index, { ...base, densityIntervals: grids[0], knownDensityKey: invalid.densityKey });
  assert.notEqual(restored.densityKey, invalid.densityKey, "an invalid/zero grid cannot poison the valid Any cache");
  assert.ok(restored.densityRows.length > 0);
  for (const bins of grids) for (const minSamples of minima) for (const presenceMode of ["all", "any"]) {
    const query = { target: 15900, selectedCountries: countries, presenceMode, minSamples,
      sliceMode: "formed", maxDeltaYbp: 300, anchorId: null, scopeAllCountries: false,
      includeSuggestions: false, densityIntervals: bins };
    const result = collect(index, query);
    const expected = oracle(index, countries, presenceMode, minSamples, bins);
    assert.deepEqual(result.densityRows.map(row => row.node.id).sort(), [...expected.keys()].sort(),
      `interval membership: ${presenceMode}, min ${minSamples}, ${bins.length} bins`);
    if (presenceMode === "all") for (const row of result.densityRows) {
      assert.deepEqual(row.participatingCountries, expected.get(row.node.id));
    }
    for (const target of [3000, 5000, 18500, 50000]) {
      const moved = collect(index, { ...query, target, maxDeltaYbp: 150, knownDensityKey: result.densityKey });
      assert.equal(moved.densityKey, result.densityKey);
      assert.equal(moved.densityRows, null, "moving within linear/log sections retains the chart payload");
    }
  }
}

/** Deliberately independent, slower sample/path oracle: no production pool/group helpers. */
function oracle(index, countries, mode, minimum, bins) {
  const samples = countries.flatMap(code => index.samplesByCountry.get(code) ?? []);
  const nodes = new Map(samples.flatMap(sample => sample.path.map((node, i) =>
    [node.id, { node, parent: sample.path[i - 1] }])));
  const expected = new Map();
  for (let i = 0; i < bins.length; i++) {
    const bin = bins[i];
    const inside = node => node.formedKnown !== false && node.formed <= bin.older
      && (node.formed > bin.younger || i === bins.length - 1 && node.formed === bin.younger);
    const pool = new Map();
    for (const sample of samples) if (sample.path.some(inside)) {
      pool.set(sample.country, (pool.get(sample.country) ?? 0) + sample.count);
    }
    const required = mode === "any" || minimum === 0 ? countries
      : countries.filter(code => (pool.get(code) ?? 0) >= minimum);
    for (const { node } of nodes.values()) {
      if (!inside(node) || !required.length) continue;
      let root = nodes.get(node.id);
      while (root.parent?.formedKnown !== false && root.parent?.formed === node.formed) root = nodes.get(root.parent.id);
      const supported = new Set(samples.filter(sample => sample.path.some(item => item.id === root.node.id)).map(sample => sample.country));
      if (mode === "any" ? required.some(code => supported.has(code)) : required.every(code => supported.has(code))) {
        expected.set(node.id, required);
      }
    }
  }
  return expected;
}
