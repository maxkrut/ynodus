import type { TimeAnalysisResult } from "../shared/types";
import { ANALYSIS_DEBOUNCE_MS, TABLE_INITIAL_ROW_LIMIT } from "./constants";
import type { TextKey } from "./i18n";
import type { AppState, CommittedQuerySnapshot } from "./state";
import type { WorkerClient } from "./worker-client";
import {
  analysisCountryScope,
  analysisScopeIsValid,
  cohortSampleCount,
} from "./query-model";
import { runtimeErrorSummary } from "./runtime-errors";

type AnalysisController = {
  queueAnalysis: () => void;
  previewAnalysis: () => void;
  invalidateRequests: () => void;
};

type AnalysisControllerOptions = {
  state: AppState;
  workerClient: WorkerClient;
  exportButton: HTMLButtonElement;
  resultsRoot: HTMLDivElement;
  emptyState: HTMLDivElement;
  captureCommittedQuery: () => CommittedQuerySnapshot;
  hasQueryDraft?: () => boolean;
  t: (key: TextKey) => string;
  setEmpty: (message: string) => void;
  renderTarget: (renderDensity?: boolean) => void;
  renderStats: () => void;
  renderLiveStatus: () => void;
  renderPendingResults: () => void;
  renderResults: () => void;
};

export function createAnalysisController({
  state,
  workerClient,
  exportButton,
  resultsRoot,
  emptyState,
  captureCommittedQuery,
  hasQueryDraft = () => false,
  t,
  setEmpty,
  renderTarget,
  renderStats,
  renderLiveStatus,
  renderPendingResults,
  renderResults,
}: AnalysisControllerOptions): AnalysisController {
  let autoAnalyzeTimer: number | null = null;
  let analyzeRequestToken = 0;
  let previewActive = false;

  function analyze(): void {
    if (autoAnalyzeTimer !== null) {
      window.clearTimeout(autoAnalyzeTimer);
      autoAnalyzeTimer = null;
    }

    if (!state.index) {
      invalidateResults("emptyLoadFirst");
      return;
    }

    if (!analysisScopeIsValid(state.selectedCountries)) {
      invalidateResults("emptySelectCountry");
      resultsRoot.hidden = true;
      exportButton.disabled = true;
      renderStats();
      return;
    }

    const token = ++analyzeRequestToken;
    const query = captureCommittedQuery();
    state.analysisBusy = true;
    exportButton.disabled = true;
    renderLiveStatus();
    void analyzeInWorker(token, query);
  }

  function queueAnalysis(previewOnly = false): void {
    if (!previewOnly) previewActive = false;
    if (!state.analysisBusy && state.committedQuery && !hasQueryDraft()
      && sameAnalysisQuery(state.committedQuery, captureCommittedQuery())) return;
    exportButton.disabled = true;
    const hadVisibleResults = !resultsRoot.hidden;
    state.results = [];
    state.crossingResults = [];
    // Keep the last diagram as explicitly pending context, never as current results.
    // Its key still lets the worker decide whether fresh density must be transferred.
    state.neighborSuggestions = null;
    state.countryMinimumOffer = null;
    state.countryParticipation = null;
    state.committedQuery = null;
    state.analysisCohortSampleCount = null;
    state.analysisResultSupportCount = null;
    state.analysisBusy = true;
    if (hadVisibleResults) renderPendingResults();
    renderTarget();
    analyzeRequestToken += 1;

    if (autoAnalyzeTimer !== null) {
      window.clearTimeout(autoAnalyzeTimer);
      autoAnalyzeTimer = null;
    }

    if (!state.index) {
      invalidateResults("emptyLoadFirst");
      renderLiveStatus();
      renderStats();
      return;
    }

    if (!analysisScopeIsValid(state.selectedCountries)) {
      invalidateResults("emptySelectCountry");
      renderStats();
      renderLiveStatus();
      return;
    }

    renderLiveStatus();
    if (hadVisibleResults) {
      renderStats();
    } else {
      invalidateResults("recalculating");
      renderStats();
    }

    if (previewOnly || hasQueryDraft()) return;
    autoAnalyzeTimer = window.setTimeout(() => {
      autoAnalyzeTimer = null;
      analyze();
    }, ANALYSIS_DEBOUNCE_MS);
  }

  function invalidateRequests(): void {
    analyzeRequestToken += 1;
  }

  async function analyzeInWorker(token: number, query: CommittedQuerySnapshot): Promise<void> {
    try {
      const analysis = await requestAnalysis(query);
      if (token !== analyzeRequestToken) return;
      applyAnalysisResult(analysis, query);
    } catch (error) {
      if (token !== analyzeRequestToken) return;
      state.analysisBusy = false;
      exportButton.disabled = true;
      renderLiveStatus();
      resultsRoot.removeAttribute("aria-busy");
      const message = error instanceof Error ? error.message : String(error);
      console.error("Analysis request failed", error);
      state.emptyMessageKey = null;
      state.emptyErrorMessage = message;
      state.densityRows = [];
      state.densityKey = null;
      renderTarget();
      emptyState.setAttribute("role", "alert");
      setEmpty(runtimeErrorSummary(message, t, "analysis"));
      resultsRoot.hidden = true;
      emptyState.hidden = false;
    }
  }

  async function requestAnalysis(query: CommittedQuerySnapshot): Promise<TimeAnalysisResult> {
    const countryScope = analysisCountryScope(new Set(query.selectedCountries));
    const response = await workerClient.request({
      type: "analyze",
      target: query.targetYbp,
      selectedCountries: countryScope.selectedCountries,
      scopeAllCountries: countryScope.scopeAllCountries,
      presenceMode: query.presenceMode,
      includeCrossing: query.includeCrossing,
      minSamples: query.minResultSamples,
      maxDeltaYbp: query.maxDeltaYbp,
      anchorId: null,
      knownDensityKey: state.densityKey,
    });
    if (response.type !== "analyze") throw new Error("Unexpected worker response.");
    return response.result;
  }

  function applyAnalysisResult(
    analysis: TimeAnalysisResult,
    query: CommittedQuerySnapshot,
  ): void {
    const { formed, crossing } = analysis;
    state.results = formed.rows;
    state.crossingResults = crossing?.rows ?? [];
    if (formed.densityRows) {
      state.densityRows = formed.densityRows;
      state.densityKey = formed.densityKey;
    } else if (state.densityKey !== formed.densityKey) {
      throw new Error("Worker omitted density for an unknown evidence scope.");
    }
    state.tableRowLimit = TABLE_INITIAL_ROW_LIMIT;
    state.crossingTableRowLimit = TABLE_INITIAL_ROW_LIMIT;
    state.analysisBusy = false;
    state.committedQuery = { ...query, minResultSamples: formed.minSamples };
    state.minResultSamples = formed.minSamples;
    state.presenceMode = query.presenceMode;
    state.countryMinimumOffer = query.presenceMode === "all" && query.selectedCountries.length > 0
      && formed.countryMinimumNotMet
      ? { countries: [...query.selectedCountries], minimum: Math.max(1, formed.minSamples) } : null;
    state.countryParticipation = query.presenceMode === "all" && formed.participatingCountries
      ? { formed: formed.participatingCountries, crossing: crossing?.participatingCountries ?? null } : null;
    state.emptyMessageKey = null;
    state.emptyErrorMessage = null;
    state.analysisCohortSampleCount = cohortSampleCount(
      state.index,
      state.selectedCountries,
    );
    state.analysisResultSupportCount = formed.matchingSamples;
    state.neighborSuggestions = formed.suggestions;
    renderLiveStatus();

    renderTarget();
    renderResults();
  }

  function invalidateResults(key: TextKey): void {
    state.analysisBusy = false;
    state.results = [];
    state.crossingResults = [];
    state.densityRows = [];
    state.densityKey = null;
    state.committedQuery = null;
    state.analysisCohortSampleCount = null;
    state.analysisResultSupportCount = null;
    state.neighborSuggestions = null;
    state.countryMinimumOffer = null;
    state.countryParticipation = null;
    state.emptyMessageKey = key;
    state.emptyErrorMessage = null;
    emptyState.setAttribute("role", "status");
    renderTarget();
    exportButton.disabled = true;
    resultsRoot.removeAttribute("aria-busy");
    resultsRoot.hidden = true;
    emptyState.hidden = false;
    setEmpty(t(key));
  }

  return {
    queueAnalysis,
    previewAnalysis: () => {
      if (previewActive) return;
      previewActive = true;
      queueAnalysis(true);
    },
    invalidateRequests,
  };
}

function sameAnalysisQuery(left: CommittedQuerySnapshot, right: CommittedQuerySnapshot): boolean {
  return left.targetYbp === right.targetYbp && left.maxDeltaYbp === right.maxDeltaYbp
    && left.presenceMode === right.presenceMode && left.minResultSamples === right.minResultSamples
    && left.includeCrossing === right.includeCrossing
    && left.selectedCountries.join() === right.selectedCountries.join()
    && left.provenance?.version === right.provenance?.version
    && left.provenance?.generatedAt === right.provenance?.generatedAt
    && left.provenance?.sampleScope === right.provenance?.sampleScope;
}
