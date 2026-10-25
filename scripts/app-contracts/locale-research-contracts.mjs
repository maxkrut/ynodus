import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./runtime.mjs";
import {
  analyzePayload, analysisState, analysisResult, analysisSliceResult,
  fakeWorker, fakeElement, fakeEventTarget, signatureRow, resultRow,
  captureCommittedQuery, provenanceIndex,
} from "./fixtures.mjs";

export function assertLocalePreservesQueryAndResultState(createLocaleController, locales) {
  const selectedCountries = new Set(["AA", "BB"]);
  const signatureSource = signatureRow("R-LOCALE", 9, [["AA", 4], ["BB", 5]]);
  const results = [resultRow("R-RESULT", 9, "formed")];
  const crossingResults = [resultRow("R-CROSS", 5, "crossing-through", "R-CROSS-CHILD")];
  const densityRows = [{ node: results[0].node, total: 9 }];
  const state = {
    locale: "en",
    loading: false,
    index: provenanceIndex(),
    analysisBusy: false,
    analysisCohortSampleCount: 9,
    selectedCountries,
    countryFilter: "united",
    activePreset: "test-preset",
    signatureQuery: "R-LOCALE",
    signatureSource,
    presenceMode: "all",
    includeCrossing: true,
    minResultSamples: 3,
    maxDeltaYbp: 250,
    results,
    crossingResults,
    densityRows,
  };
  const localeSwitcher = { value: "" };
  const provenanceStrip = { innerHTML: "" };
  const provenanceNotes = { innerHTML: "" };
  let resultRenders = 0;
  let pendingRenders = 0;
  let queuedAnalyses = 0;
  const previousDocument = globalThis.document;
  globalThis.document = {
    documentElement: { lang: "en" },
    querySelectorAll: () => [],
  };

  try {
    const controller = createLocaleController({
      state,
      localeSwitcher,
      exportButton: { title: "", setAttribute() {} },
      provenanceStrip,
      provenanceNotes,
      t: (key) => locales[state.locale][key] ?? key,
      setLoading: () => {},
      setEmpty: () => {},
      renderLoadError: () => {},
      renderPresenceMode: () => {},
      renderControlTabs: () => {},
      renderSliceCopy: () => {},
      renderSliceMode: () => {},
      renderTarget: () => {},
      renderLiveStatus: () => {},
      renderCountries: () => {},
      renderSignatureSearch: () => {},
      renderStats: () => {},
      renderResults: () => { resultRenders += 1; },
      renderPendingResults: () => { pendingRenders += 1; },
      renderResearchView: () => {},
      queueAnalysis: () => { queuedAnalyses += 1; },
    });

    for (const locale of ["en", "ru",]) {
      state.locale = locale;
      controller.applyLocale();
      assert.ok(provenanceStrip.innerHTML.includes(locales[locale].sourceComputedDate),
        "date annotation labels must change language along with the source ledger");
      assert.ok(provenanceStrip.innerHTML.includes('data-annotation="snapshot-notes"'));
      assert.doesNotMatch(provenanceStrip.innerHTML, /provenance-details/);
      assert.equal(globalThis.document.documentElement.lang, locale);
      assert.equal(localeSwitcher.value, locale, "native language select must mirror the active locale");
      assert.equal(state.selectedCountries, selectedCountries, "locale changes must preserve the country selection object");
      assert.deepEqual([...state.selectedCountries], ["AA", "BB"]);
      assert.equal(state.countryFilter, "united");
      assert.equal(state.activePreset, "test-preset");
      assert.equal(state.signatureQuery, "R-LOCALE");
      assert.equal(state.signatureSource, signatureSource);
      assert.equal(state.results, results, "locale changes must preserve the committed result snapshot");
      assert.equal(state.crossingResults, crossingResults,
        "locale changes must preserve the optional Crossing result snapshot");
      assert.equal(state.densityRows, densityRows);
      assert.equal(state.presenceMode, "all");
      assert.equal(state.includeCrossing, true);
    }
  } finally {
    globalThis.document = previousDocument;
  }

  assert.equal(queuedAnalyses, 0, "EN → RU must not queue analysis or reset the current query");
  assert.equal(resultRenders, 2, "each locale must rerender the same committed results");
  assert.equal(pendingRenders, 0);
  assert.match(provenanceStrip.innerHTML, /14\.03\.00[\s\S]*14\.04\.0/);
}

export function assertLocaleDoesNotResurrectPendingResults(createLocaleController) {
  const state = {
    locale: "ru",
    loading: false,
    index: null,
    analysisBusy: true,
    analysisCohortSampleCount: null,
  };
  let resultRenders = 0;
  let pendingRenders = 0;
  const previousDocument = globalThis.document;
  globalThis.document = {
    documentElement: { lang: "en" },
    querySelectorAll: () => [],
  };
  try {
    const controller = createLocaleController({
      state,
      localeSwitcher: { value: "" },
      exportButton: { title: "", setAttribute() {} },
      provenanceStrip: { innerHTML: "", querySelector: () => null },
      t: (key) => key,
      setLoading: () => {},
      setEmpty: () => {},
      renderLoadError: () => {},
      renderPresenceMode: () => {},
      renderControlTabs: () => {},
      renderSliceCopy: () => {},
      renderSliceMode: () => {},
      renderTarget: () => {},
      renderLiveStatus: () => {},
      renderCountries: () => {},
      renderSignatureSearch: () => {},
      renderStats: () => {},
      renderResults: () => { resultRenders += 1; },
      renderPendingResults: () => { pendingRenders += 1; },
      renderResearchView: () => {},
    });
    controller.applyLocale();
  } finally {
    globalThis.document = previousDocument;
  }
  assert.equal(resultRenders, 0, "locale change during pending must not render committed results");
  assert.equal(pendingRenders, 1, "locale change during pending must rerender the pending state");
}

export function assertLocalePreservesLoadRetry(createLocaleController) {
  const state = {
    locale: "en",
    loading: false,
    index: null,
    loadErrorDetail: "Runtime dataset returned HTML",
    analysisBusy: false,
    analysisCohortSampleCount: null,
  };
  let loadErrorRenders = 0;
  let plainEmptyRenders = 0;
  const previousDocument = globalThis.document;
  globalThis.document = {
    documentElement: { lang: "en" },
    querySelectorAll: () => [],
  };
  try {
    createLocaleController({
      state,
      localeSwitcher: { value: "" },
      exportButton: { title: "", setAttribute() {} },
      provenanceStrip: { innerHTML: "", querySelector: () => null },
      t: (key) => key,
      setLoading: () => {},
      setEmpty: () => { plainEmptyRenders += 1; },
      renderLoadError: () => { loadErrorRenders += 1; },
      renderPresenceMode: () => {},
      renderControlTabs: () => {},
      renderSliceCopy: () => {},
      renderSliceMode: () => {},
      renderTarget: () => {},
      renderLiveStatus: () => {},
      renderCountries: () => {},
      renderSignatureSearch: () => {},
      renderStats: () => {},
      renderResults: () => {},
      renderPendingResults: () => {},
      renderResearchView: () => {},
    }).applyLocale();
  } finally {
    globalThis.document = previousDocument;
  }
  assert.equal(loadErrorRenders, 1,
    "changing locale after an index-load failure must keep the retry action visible");
  assert.equal(plainEmptyRenders, 0,
    "the generic empty state must not overwrite a load failure with Retry");
}

export async function assertResearchNavigationInvalidatesStaleRequests(createResearchController) {
  const previousWindow = globalThis.window;
  const previousHistory = globalThis.history;
  const previousDocument = globalThis.document;
  const listeners = new Map();
  globalThis.window = {
    addEventListener(type, listener) { listeners.set(type, listener); },
  };
  globalThis.history = {
    state: {},
    replaceState(state) { this.state = state; },
    pushState(state) { this.state = state; },
  };
  globalThis.document = {
    getElementById: () => ({ focus() {} }),
    querySelector: () => null,
  };
  let resolveRequest;
  const request = new Promise((resolve) => { resolveRequest = resolve; });
  const state = {
    researchView: "time",
    researchBusy: false,
    researchError: null,
    profile: null,
    countryEvidence: null,
    countryOverview: null,
    countryEvidenceParentView: "profile",
    signatureSource: null,
    signatureQuery: "",
  };
  const panel = () => ({ hidden: false, classList: { toggle() {} }, querySelector: () => null });
  const tab = (view) => ({
    dataset: { researchView: view },
    classList: { toggle() {} },
    setAttribute() {},
    removeAttribute() {},
  });
  const content = () => ({ innerHTML: "", querySelector: () => null, addEventListener() {},
    replaceChildren() { this.innerHTML = ""; } });
  const elements = {
    timeWorkspace: panel(),
    profileWorkspace: panel(),
    countryEvidenceWorkspace: panel(),
    countryOverviewWorkspace: panel(),
    profileContent: content(),
    countryEvidenceContent: content(),
    countryOverviewContent: content(),
    countryOverviewSelect: { value: "", disabled: false, innerHTML: "" },
    researchViewButtons: [tab("time"), tab("profile"), tab("country-overview")],
  };
  try {
    const controller = createResearchController({
      state,
      elements,
      workerClient: { request: () => request },
      t: (key) => key,
      formatCalendar: String,
      formatNumber: String,
      countryName: (code) => code,
      countryFlag: () => "",
      subcladeUrl: () => "",
      setTargetFromYbp: () => {},
      queueAnalysis: () => {},
      renderSignatureSearch: () => {},
      renderControlTabs: () => {},
      renderSliceCopy: () => {},
    });
    const pending = controller.loadProfile("R-LATE");
    listeners.get("popstate")({ state: { ynodusView: "time" } });
    resolveRequest({
      type: "subcladeProfile",
      profile: {
        node: { id: "R-LATE", project: "R", formed: 5000, formedKnown: true },
        path: [], parent: null, total: 1, countryCounts: new Map(), directTotal: 1,
        directCountryCounts: new Map(), immediateBranches: [],
        evidenceTree: { node: { id: "R-LATE", project: "R", formed: 5000, formedKnown: true }, total: 1, directTotal: 1, countryCounts: new Map(), children: [] },
        supportedDescendantCount: 0,
        datedDescendantCount: 0,
      },
    });
    assert.equal(await pending, false,
      "a profile response arriving after Back must be rejected as stale");
    assert.equal(state.researchView, "time");
    assert.equal(state.profile, null);
    assert.equal(state.researchBusy, false);
  } finally {
    globalThis.window = previousWindow;
    globalThis.history = previousHistory;
    globalThis.document = previousDocument;
  }
}
