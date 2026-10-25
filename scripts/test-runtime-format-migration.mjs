import assert from "node:assert/strict";
import { migrateRuntimeFormat } from "./runtime-format-migration.mjs";

const fixture = {
  format: "legacy-fixture/hras-index-v3", formatVersion: 3,
  nodeIds: ["R-SYN-ROOT"], nodes: [[0, -1, 5000]], projectIds: ["R"],
  countryCodes: ["RUS"], countryCounts: [3], samples: [[0, 0, 3]], ancientCounts: [1],
  nodeCount: 1, sampleCount: 3, generatedAt: "2026-01-01T00:00:00Z",
  inputSnapshot: { format: "ynodus/source-snapshot-v1", referenceCommit: "a".repeat(40) },
  sourceLicenses: { referenceTree: "CC BY 4.0" },
};
const original = structuredClone(fixture);
const migrated = migrateRuntimeFormat(fixture);
assert.deepEqual(migrated, { ...original, format: "ynodus/hras-index-v3" });
assert.deepEqual(fixture, original, "migration cannot mutate its source snapshot");
assert.deepEqual(migrateRuntimeFormat(migrated), migrated, "namespace migration is idempotent");
for (const change of [
  { formatVersion: 2 }, { format: "unrelated-v3" }, { nodes: [] }, { samples: null },
  { sampleCount: 4 }, { ancientCounts: [] }, { samples: [[0, 0, -3]], sampleCount: -3 },
]) assert.throws(() => migrateRuntimeFormat({ ...fixture, ...change }), /version-3|index array/);
console.log("Runtime namespace migration passed: only format changes; evidence and provenance remain intact.");
