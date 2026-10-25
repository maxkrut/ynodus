export function analyzePayload() {
  return {
    type: "analyze",
    target: 5500,
    selectedCountries: ["AA"],
    presenceMode: "any",
    includeCrossing: true,
    maxDeltaYbp: 300,
    minSamples: 7,
    anchorId: null,
    scopeAllCountries: false,
  };
}

export function analysisState() {
  return {
    index: { countries: new Map([["AA", 10]]) },
    selectedCountries: new Set(["AA"]),
    minResultSamples: 7,
    presenceMode: "all",
    includeCrossing: true,
    maxDeltaYbp: 300,
    analysisBusy: false,
    results: [],
    crossingResults: [],
    densityRows: [],
    densityKey: null,
    tableRowLimit: 0,
    crossingTableRowLimit: 0,
    analysisCohortSampleCount: null,
    analysisResultSupportCount: null,
    neighborSuggestions: null,
  };
}

export function analysisResult(crossing) {
  return {
    formed: analysisSliceResult(resultRow("R-FORMED", 6, "formed-in-slice")),
    crossing: analysisSliceResult(crossing),
  };
}

export function analysisSliceResult(row) {
  return {
    rows: [row],
    densityRows: [],
    densityKey: "density-test",
    matchingSamples: 6,
    minSamples: 7,
    suggestions: null,
  };
}

export function fakeWorker() {
  const listeners = new Map();
  return {
    posts: [],
    addEventListener(type, listener) {
      const group = listeners.get(type) ?? [];
      group.push(listener);
      listeners.set(type, group);
    },
    postMessage(message) {
      this.posts.push(message);
    },
    emit(type, event) {
      for (const listener of listeners.get(type) ?? []) listener(event);
    },
  };
}

export function fakeElement() {
  return {
    hidden: false,
    removeAttribute() {},
    setAttribute() {},
  };
}

export function fakeEventTarget(dataset = {}) {
  const listeners = new Map();
  return {
    dataset,
    addEventListener(type, listener) {
      const group = listeners.get(type) ?? [];
      group.push(listener);
      listeners.set(type, group);
    },
    dispatch(type, event = {}) {
      for (const listener of listeners.get(type) ?? []) listener({ key: "", preventDefault() {}, ...event });
    },
    focus() {},
  };
}

export function signatureRow(id, total, countryCounts = []) {
  return {
    node: { id, project: "R", formed: 5000, formedKnown: true },
    total,
    countryCounts: new Map(countryCounts),
    signature: id,
  };
}

export function resultRow(id, total, sliceRelation, crossingChildId) {
  const node = { id, project: "R", formed: 6000, formedKnown: true };
  const crossingChild = crossingChildId
    ? { id: crossingChildId, project: "R", formed: 3000, formedKnown: true }
    : undefined;
  const path = crossingChild ? [node, crossingChild] : [node];
  return {
    node,
    crossingChild,
    formedMembers: crossingChild ? undefined : [{ node, path }],
    total,
    delta: 1000,
    countryCounts: new Map([["AA", total]]),
    path,
    sliceRelation,
  };
}

export function captureCommittedQuery(state, targetYbp) {
  return {
    selectedCountries: [...state.selectedCountries].sort(),
    presenceMode: state.presenceMode,
    includeCrossing: state.includeCrossing,
    minResultSamples: state.minResultSamples,
    maxDeltaYbp: state.maxDeltaYbp,
    targetYbp,
    targetYear: "3500",
    targetEra: "BCE",
  };
}

export function provenanceIndex() {
  return {
    format: "ynodus/hras-index-v3",
    formatVersion: 3,
    source: "HRAS/YSEQ",
    sourceUrl: "https://hras.yseq.net/",
    sourceManifestUrl: "https://hras.yseq.net/data/manifest",
    licenseNotice: "See NOTICE.md",
    sourceLicenses: {
      applicationCode: "Apache-2.0",
      referenceTree: "CC BY 4.0",
      hrasSourceCode: "Apache-2.0",
    },
    version: "v14.03.00",
    officialVersion: "14.04.0",
    computedDate: "Jun 14 2026",
    generatedAt: "2026-08-13T14:41:00.379Z",
    manifestSampleCount: 48_724,
    sampleCount: 48_713,
    nodes: 68_883,
    maxFormedYbp: 250_000,
    countries: new Map([["AA", 24_000], ["BB", 24_713]]),
  };
}
