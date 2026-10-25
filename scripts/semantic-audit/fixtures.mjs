export function compact(parents, ages, samples, label = "synthetic") {
  const countryCodes = ["AAA", "BBB", "CCC"];
  const countryCounts = countryCodes.map((_, i) => samples.filter((s) => s[1] === i).reduce((s, r) => s + r[2], 0));
  return { format: "ynodus/hras-index-v3", formatVersion: 3,
    source: "Synthetic semantic audit", sourceUrl: "https://example.invalid/tree",
    sourceManifestUrl: "https://example.invalid/manifest", licenseNotice: "Synthetic fixture",
    sourceLicenses: { applicationCode: "test", referenceTree: "test", hrasSourceCode: "test" },
    treeVersion: label, treeOfficialVersion: "synthetic", computedDate: "2026-09-22",
    generatedAt: "2026-09-22T00:00:00Z", hrasManifestSampleCount: Math.max(1, countryCounts.reduce((a, b) => a + b, 0)),
    projectIds: ["SYN"], countryCodes, countryCounts,
    nodeIds: parents.map((_, i) => `SYN-${String(i).padStart(3, "0")}`),
    nodes: parents.map((p, i) => [0, p, ages[i]]), samples };
}

export const query = (overrides = {}) => ({ target: 2, maxDeltaYbp: 0, minSamples: 0,
  selectedCountries: ["AAA", "BBB"], presenceMode: "any", includeCrossing: true,
  anchorId: null, scopeAllCountries: false, includeSuggestions: false, ...overrides });

// Each shape isolates a semantic seam; all identifiers are invented.
export function handCases() {
  return [
    { name: "same-age-fork-direct-and-nested", data: compact([-1, 0, 0, 1], [2, 2, 2, 1],
      [[0, 0, 2], [1, 0, 3], [2, 1, 5], [3, 1, 7]]), q: query() },
    { name: "unknown-gap", data: compact([-1, 0, 1], [2, null, 2], [[2, 0, 4]]), q: query() },
    { name: "out-of-window-gap", data: compact([-1, 0, 1], [2, 5, 2], [[2, 0, 4]]), q: query() },
    { name: "unrelated-ties", data: compact([-1, -1], [2, 2], [[0, 0, 3], [1, 1, 5]]), q: query() },
    { name: "presence-before-branch-merge", data: compact([-1, 0, 0], [3, 2, 2],
      [[1, 0, 2], [2, 1, 3]]), q: query({ target: 3, maxDeltaYbp: 1, presenceMode: "all" }) },
    { name: "inverted-crossing", data: compact([-1, 0], [1, 3], [[1, 0, 4]]), q: query() },
    { name: "crossing-endpoint", data: compact([-1, 0], [3, 1], [[1, 0, 4]]), q: query({ target: 3 }) },
    { name: "unknown-zero", data: compact([-1, 0], [0, 2], [[1, 0, 4]]), q: query({ target: 0 }) },
    { name: "root-evidence-not-sum-of-events", data: compact([-1, 0, 1], [3, 2, 1],
      [[0, 0, 2], [1, 0, 3], [2, 1, 5]]), q: query({ maxDeltaYbp: 1 }) },
    { name: "filtered-same-age-member", data: compact([-1, 0], [2, 2],
      [[0, 0, 9], [1, 0, 1]]), q: query({ minSamples: 5 }) },
    { name: "snapshot-threshold-exactly-equal", data: compact([-1, 0, 0], [3, 2, 2],
      [[1, 0, 5], [2, 1, 6]]), q: query({ minSamples: 5, presenceMode: "all" }) },
    { name: "snapshot-rare-country-does-not-block", data: compact([-1, 0, 0], [3, 2, 2],
      [[1, 0, 5], [2, 1, 1]]), q: query({ minSamples: 5, presenceMode: "all" }) },
  ];
}

export function* parentVectors(n, prefix = []) {
  if (prefix.length === n) { yield prefix; return; }
  for (let p = -1; p < prefix.length; p++) yield* parentVectors(n, [...prefix, p]);
}

export function* combinations(values, n, prefix = []) {
  if (prefix.length === n) { yield prefix; return; }
  for (const value of values) yield* combinations(values, n, [...prefix, value]);
}

export function random(seed) {
  let state = seed >>> 0;
  return (n) => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state % n; };
}

export function generatedForest(rng, label) {
  const n = 1 + rng(24), parents = [], ages = [], samples = [];
  for (let i = 0; i < n; i++) {
    parents.push(rng(i + 1) - 1);
    ages.push([null, 0, 1, 2, 3, 5, 8][rng(7)]);
    for (let c = 0; c < 3; c++) if (rng(3) === 0) samples.push([i, c, 1 + rng(7)]);
  }
  if (!samples.length) samples.push([n - 1, 0, 1]);
  return compact(parents, ages, samples, label);
}
