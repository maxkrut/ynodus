/** Only the namespace changes: source evidence and provenance remain the original snapshot. */
export function migrateRuntimeFormat(payload) {
  if (!payload || payload.formatVersion !== 3 || typeof payload.format !== "string"
    || !/^[a-z][a-z0-9-]*\/hras-index-v3$/.test(payload.format)) {
    throw new Error("Runtime namespace migration requires a version-3 HRAS index.");
  }
  for (const field of ["nodeIds", "nodes", "projectIds", "countryCodes", "countryCounts", "samples"]) {
    if (!Array.isArray(payload[field])) throw new Error(`Missing index array: ${field}`);
  }
  if (payload.nodeCount !== payload.nodeIds.length || payload.nodes.length !== payload.nodeIds.length
    || payload.countryCodes.length !== payload.countryCounts.length
    || payload.samples.some(sample => !Array.isArray(sample) || !Number.isSafeInteger(sample[2]) || sample[2] < 0)
    || payload.sampleCount !== payload.samples.reduce((sum, sample) => sum + sample[2], 0)
    || (payload.ancientCounts && (!Array.isArray(payload.ancientCounts) || payload.ancientCounts.length !== payload.samples.length))) {
    throw new Error("Inconsistent version-3 HRAS index counts.");
  }
  return { ...payload, format: "ynodus/hras-index-v3" };
}
