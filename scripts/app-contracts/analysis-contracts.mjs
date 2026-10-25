import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./runtime.mjs";
import {
  analyzePayload, analysisState, analysisResult, analysisSliceResult,
  fakeWorker, fakeElement, fakeEventTarget, signatureRow, resultRow,
  captureCommittedQuery, provenanceIndex,
} from "./fixtures.mjs";

export async function assertAnalysisRequestContract(createAnalysisController, anchor, crossing) {
  const previousWindow = globalThis.window;
  globalThis.window = {
    setTimeout: (callback) => {
      callback();
      return 1;
    },
    clearTimeout() {},
  };
  const requests = [];
  const state = {
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
  const formed = resultRow("R-FORMED", 6, "formed-in-slice");
  const result = {
    formed: analysisSliceResult(formed),
    crossing: analysisSliceResult(crossing),
  };
  const controller = createAnalysisController({
    state,
    workerClient: {
      request: async (request) => {
        requests.push(request);
        return { type: "analyze", result };
      },
    },
    exportButton: { disabled: false },
    resultsRoot: fakeElement(),
    emptyState: fakeElement(),
    captureCommittedQuery: () => captureCommittedQuery(state, 5500),
    t: (key) => key,
    setEmpty: () => {},
    renderTarget: () => {},
    renderStats: () => {},
    renderLiveStatus: () => {},
    renderPendingResults: () => {},
    renderResults: () => {},
  });

  try {
    controller.queueAnalysis();
    await new Promise((resolve) => setTimeout(resolve, 0));
  } finally {
    globalThis.window = previousWindow;
  }

  assert.equal(requests.length, 1);
  assert.equal(requests[0].anchorId, null);
  assert.deepEqual(requests[0].selectedCountries, ["AA"]);
  assert.equal(requests[0].scopeAllCountries, false);
  assert.equal(requests[0].presenceMode, "all", "one-country searches retain the selected minimum behavior");
  assert.equal(requests[0].includeCrossing, true);
  assert.equal(state.presenceMode, "all");
  assert.equal(requests[0].minSamples, 7);
  assert.equal(state.analysisCohortSampleCount, 10);
  assert.equal(state.analysisResultSupportCount, 6);
  assert.equal(state.results.length, 1);
  assert.equal(state.committedQuery.targetYbp, 5500);
  assert.equal(state.results[0].node.id, "R-FORMED");
  assert.equal(state.crossingResults[0].crossingChild.id, "R-CHILD");
}

export async function assertImmediateRecalculationContract(createAnalysisController, anchor, crossing) {
  const previousWindow = globalThis.window;
  globalThis.window = {
    setTimeout: (callback) => {
      callback();
      return 1;
    },
    clearTimeout() {},
  };
  const requests = [];
  const state = analysisState(anchor);
  state.index = { countries: new Map([["AA", 100_001]]) };
  state.selectedCountries = new Set(["AA"]);
  state.signatureSource = null;
  state.results = [crossing];
  state.densityRows = [{ node: crossing.node, total: crossing.total }];
  const exportButton = { disabled: false };
  let pendingState = null;
  const result = analysisResult(crossing);
  const controller = createAnalysisController({
    state,
    workerClient: {
      request: async (request) => {
        requests.push(request);
        return { type: "analyze", result };
      },
    },
    exportButton,
    resultsRoot: fakeElement(),
    emptyState: fakeElement(),
    captureCommittedQuery: () => captureCommittedQuery(state, 5500),
    t: (key) => key,
    setEmpty: () => {},
    renderTarget: () => {},
    renderStats: () => {},
    renderLiveStatus: () => {},
    renderPendingResults: () => {
      pendingState = {
        results: [...state.results],
        densityRows: [...state.densityRows],
        busy: state.analysisBusy,
      };
    },
    renderResults: () => {},
  });
  try {
    controller.queueAnalysis();
    assert.equal(exportButton.disabled, true, "query change must disable export synchronously");
    assert.deepEqual(pendingState, { results: [], densityRows: [{ node: crossing.node, total: crossing.total }], busy: true },
      "pending clears result rows but preserves the previous diagram as inactive context");
    await Promise.resolve();
  } finally {
    globalThis.window = previousWindow;
  }
  assert.equal(requests.length, 1, "a valid large cohort must still recalculate immediately");
}

export async function assertCountryMinimumReset(createAnalysisController, crossing) {
  const previousWindow = globalThis.window;
  globalThis.window = { setTimeout(callback) { callback(); return 1; }, clearTimeout() {} };
  const tick = () => new Promise(resolve => setTimeout(resolve, 0));
  const complete = analysisResult(crossing);
  const belowMinimum = { formed: { ...complete.formed, rows: [], densityRows: [],
    densityKey: "below-minimum", matchingSamples: 0, countryMinimumNotMet: true }, crossing: null };
  function setup(overrides = {}) {
    const state = { ...analysisState(), countryMinimumOffer: null, ...overrides };
    const pending = [], exportButton = { disabled: false };
    const controller = createAnalysisController({ state,
      workerClient: { request: payload => new Promise((resolve, reject) => pending.push({ payload, resolve, reject })) },
      exportButton, resultsRoot: fakeElement(), emptyState: fakeElement(),
      captureCommittedQuery: () => captureCommittedQuery(state, 5500), t: key => key,
      setEmpty() {}, renderTarget() {}, renderStats() {}, renderLiveStatus() {}, renderPendingResults() {},
      renderResults() {},
    });
    controller.queueAnalysis();
    return { state, controller, pending, exportButton };
  }
  const reply = (request, result) => request.resolve({ type: "analyze", result });
  try {
    for (const countries of [["AA"], ["AA", "BB"]]) {
      const offered = setup({ selectedCountries: new Set(countries) });
      reply(offered.pending[0], belowMinimum);
      await tick();
      assert.equal(offered.pending.length, 1, "a failed minimum never retries or changes mode automatically");
      assert.equal(offered.state.presenceMode, "all");
      assert.equal(offered.state.committedQuery.presenceMode, "all");
      assert.deepEqual(offered.state.countryMinimumOffer, { countries, minimum: 7 });
      assert.deepEqual(offered.state.results, []);
      offered.controller.queueAnalysis();
      assert.equal(offered.pending.length, 1, "unchanged parameters keep the completed result and offer");
      assert.deepEqual(offered.state.countryMinimumOffer, { countries, minimum: 7 });
      offered.state.maxDeltaYbp += 1;
      offered.controller.queueAnalysis();
      assert.equal(offered.state.countryMinimumOffer, null, "pending immediately invalidates the old offer");
      reply(offered.pending[1], complete);
      await tick();
      assert.equal(offered.state.countryMinimumOffer, null);
    }
    const cached = setup({ densityKey: "below-minimum" });
    reply(cached.pending[0], { ...belowMinimum, formed: { ...belowMinimum.formed, densityRows: null } });
    await tick();
    assert.equal(cached.pending.length, 1);
    assert.ok(cached.state.countryMinimumOffer, "cached density cannot hide the offer");
    for (const [overrides, result] of [
      [{}, complete], [{ presenceMode: "any" }, belowMinimum],
      [{}, { ...belowMinimum, formed: { ...belowMinimum.formed, countryMinimumNotMet: false } }],
    ]) {
      const retained = setup(overrides);
      reply(retained.pending[0], result);
      await tick();
      assert.equal(retained.state.countryMinimumOffer, null);
      assert.equal(retained.pending.length, 1);
    }
    const stale = setup();
    stale.controller.queueAnalysis();
    reply(stale.pending[1], complete);
    await tick();
    reply(stale.pending[0], belowMinimum);
    await tick();
    assert.equal(stale.state.countryMinimumOffer, null, "an old response cannot restore an offer");
    assert.equal(stale.state.results, complete.formed.rows);
    const failed = setup();
    const previousError = console.error;
    try {
      console.error = () => {};
      failed.pending[0].reject(new Error("Synthetic failure"));
      await tick();
    } finally { console.error = previousError; }
    assert.equal(failed.state.countryMinimumOffer, null);
    assert.equal(failed.state.presenceMode, "all");
    assert.equal(failed.state.committedQuery, null);
    assert.equal(failed.exportButton.disabled, true);
  } finally { globalThis.window = previousWindow; }
}
