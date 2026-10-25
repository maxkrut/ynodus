export function independentCrossingCompact() {
  const nodeIds = ["ROOT", "FORMED", "COVERED_CHILD", "NEW_P", "NEW_C"];
  return {
    format: "ynodus/hras-index-v3",
    formatVersion: 3,
    source: "synthetic HRAS/YSEQ snapshot",
    sourceUrl: "https://hras.yseq.net/",
    sourceManifestUrl: "https://hras.yseq.net/data/manifest",
    licenseNotice: "synthetic fixture",
    sourceLicenses: {
      applicationCode: "Apache-2.0",
      referenceTree: "CC BY 4.0",
      hrasSourceCode: "Apache-2.0",
    },
    treeVersion: "synthetic-1",
    treeOfficialVersion: "synthetic-1",
    computedDate: "2026-01-01",
    generatedAt: "2026-01-01T00:00:00.000Z",
    nodeCount: nodeIds.length,
    sampleCount: 7,
    hrasManifestSampleCount: 7,
    projectIds: ["R"],
    countryCodes: ["AA"],
    countryCounts: [7],
    nodeIds,
    nodes: [
      [0, -1, 7000],
      [0, 0, 4500],
      [0, 1, 3500],
      [0, 0, 6000],
      [0, 3, 3000],
    ],
    samples: [
      [1, 0, 2],
      [2, 0, 2],
      [4, 0, 3],
    ],
  };
}

export function syntheticIndex() {
  const nodeIds = ["R-ROOT", "R-UNKNOWN", "R-ALL", "R-AA", "R-CHILD", "R-AA-CHILD"];
  const samples = [[5, 0, 2], [5, 1, 3], [4, 1, 3]];
  return {
    format: "ynodus/hras-index-v3",
    formatVersion: 3,
    source: "synthetic HRAS/YSEQ snapshot",
    sourceUrl: "https://hras.yseq.net/",
    sourceManifestUrl: "https://hras.yseq.net/data/manifest",
    licenseNotice: "synthetic fixture",
    sourceLicenses: {
      applicationCode: "Apache-2.0",
      referenceTree: "CC BY 4.0",
      hrasSourceCode: "Apache-2.0",
    },
    treeVersion: "synthetic-1",
    treeOfficialVersion: "synthetic-1",
    computedDate: "2026-01-01",
    generatedAt: "2026-01-01T00:00:00.000Z",
    nodeCount: nodeIds.length,
    sampleCount: 8,
    hrasManifestSampleCount: 8,
    projectIds: ["R"],
    countryCodes: ["AA", "BB"],
    countryCounts: [2, 6],
    nodeIds,
    nodes: [
      [0, -1, 7000],
      [0, 0, null],
      [0, 1, 5000],
      [0, 2, 4000],
      [0, 2, 4000],
      [0, 3, 4000],
    ],
    samples,
  };
}
