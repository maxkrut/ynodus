import assert from "node:assert/strict";
import { mergeNodes, parseReferenceTree, summarizeMerge } from "./build-hras-reference.mjs";

const node = (id, formed) => ({ id, project: "SYN", parent: null, formed });
const cases = [
  // Reference value, HRAS value, unchanged selected value.
  [5000, 4500, 5000], [5000, 5000, 5000], [0, 4500, 0],
  [null, 4500, 4500], [undefined, 4500, 4500], [5000, 0, 5000],
  [0, 0, 0], [null, null, null], [-1, 4500, -1],
];
const reference = {}, hras = {};
cases.forEach(([r, h], i) => {
  const id = `SYN-${i}`;
  reference[id] = node(id, r); hras[id] = node(id, h);
});
reference["SYN-REFERENCE-ONLY"] = node("SYN-REFERENCE-ONLY", 6000);
hras["SYN-HRAS-ONLY"] = node("SYN-HRAS-ONLY", 4000);
hras["SYN-HRAS-ZERO"] = node("SYN-HRAS-ZERO", 0);
hras["SYN-HRAS-MISSING"] = node("SYN-HRAS-MISSING", null);
const before = structuredClone({ reference, hras });
const merged = mergeNodes(hras, reference);
cases.forEach(([, , expected], i) => assert.equal(merged[`SYN-${i}`].formed, expected));
assert.equal(merged["SYN-REFERENCE-ONLY"].formed, 6000);
assert.equal(merged["SYN-HRAS-ONLY"].formed, 4000);
assert.deepEqual({ reference, hras }, before, "summarizing must not alter inputs");
const summary = summarizeMerge(hras, reference, merged);
assert.deepEqual(summary.formed, {
  selectionPolicy: "reference-non-null-otherwise-hras",
  reference: { values: 7, known: 4, unknown: 3 },
  hrasFallback: { values: 4, known: 3, unknown: 1 },
  missing: 2, known: 7, unknown: 6,
  comparison: {
    sharedNodes: 9, bothKnownEqual: 1, bothKnownDifferent: 1, bothUnknown: 2,
    referenceKnownHrasUnknown: 1, referenceUnknownHrasKnown: 4,
    referenceUnknownHrasKnownNotUsed: 2,
  },
});
assert.equal(summary.formed.known + summary.formed.unknown, summary.mergedNodeCount);
assert.equal(summary.formed.reference.values + summary.formed.hrasFallback.values + summary.formed.missing, summary.mergedNodeCount);
assert.deepEqual({ reference, hras }, before);
assert.deepEqual(summarizeMerge(hras, reference, merged), summary, "counters must be deterministic");
assert.equal("referenceTimingUsed" in summary, false, "ambiguous timing counters are replaced");
const parsed = parseReferenceTree(JSON.stringify({ id: "SYN-ROOT", formed: "0", children: [
  { id: "SYN-UNKNOWN", formed: "-" }, { id: "SYN-KNOWN", formed: "4500" },
] }));
assert.equal(parsed["SYN-ROOT"].formed, 0);
assert.equal(parsed["SYN-UNKNOWN"].formed, null);
assert.equal(parsed["SYN-KNOWN"].formed, 4500);
console.log("Merge metadata passed: known/unknown/missing counts, source disagreements and unchanged date selection.");
