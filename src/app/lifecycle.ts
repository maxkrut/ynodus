import { readSampleScope } from "./sample-scope";
import { renderProvenanceNotes, renderProvenanceStrip } from "./source-card";
import { escapeHtml } from "../shared/html";
import type { TextKey } from "./i18n";
import type { AppState } from "./state";
import { normalizeWorkerIndex, type WorkerClient } from "./worker-client";
import { retainAvailableCountries } from "./query-model";
import { runtimeErrorSummary } from "./runtime-errors";

type AppLifecycleOptions = {
  state: AppState;
  workerClient: WorkerClient;
  dataUrl: string;
  exportButton: HTMLButtonElement;
  resultsRoot: HTMLDivElement;
  emptyState: HTMLDivElement;
  provenanceStrip: HTMLElement;
  provenanceNotes?: HTMLElement;
  t: (key: TextKey) => string;
  setLoading: (loading: boolean) => void;
  invalidateAnalysisRequests: () => void;
  renderCountries: () => void;
  renderStats: () => void;
  renderTarget?: () => void;
  renderResearchView?: () => void;
  onIndexReady?: () => Promise<void>;
  queueAnalysis: () => void;
};

export function createAppLifecycle(options: AppLifecycleOptions) {
  async function loadIndex(): Promise<void> {
    const {
      state,
      workerClient,
      dataUrl,
      exportButton,
      resultsRoot,
      provenanceStrip,
      t,
      setLoading,
      invalidateAnalysisRequests,
      renderCountries,
      renderStats,
      queueAnalysis,
    } = options;

    if (state.loading) return;

    setLoading(true);
    invalidateAnalysisRequests();
    state.results = [];
    state.crossingResults = [];
    state.densityRows = [];
    state.densityKey = null;
    state.committedQuery = null;
    state.analysisCohortSampleCount = null;
    state.analysisResultSupportCount = null;
    state.neighborSuggestions = null;
    state.profile = null;
    state.countryEvidence = null;
    state.countryOverview = null;
    state.researchError = null;
    exportButton.disabled = true;
    state.loadErrorDetail = null;
    options.renderTarget?.();
    options.emptyState.setAttribute("role", "status");

    try {
      const response = await workerClient.request({ type: "load", url: dataUrl, sampleScope: readSampleScope() });
      if (response.type !== "load") throw new Error("Unexpected worker response.");
      const index = normalizeWorkerIndex(response.index);
      state.index = index;
      state.results = [];
      state.crossingResults = [];
      state.densityRows = [];
      state.densityKey = null;
      state.analysisCohortSampleCount = null;
      state.analysisResultSupportCount = null;
      state.neighborSuggestions = null;
      state.profile = null;
      state.countryEvidence = null;
      state.countryOverview = null;
      state.researchError = null;
      state.loadErrorDetail = null;
      exportButton.disabled = true;

      await options.onIndexReady?.();
      state.selectedCountries = retainAvailableCountries(index, state.selectedCountries);

      provenanceStrip.innerHTML = renderProvenanceStrip(index, {
        t,
        locale: state.locale,
      });
      if (options.provenanceNotes) options.provenanceNotes.innerHTML = renderProvenanceNotes(index, { t, locale: state.locale });
      renderCountries();
      renderStats();
      resultsRoot.hidden = true;
      queueAnalysis();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      state.emptyMessageKey = null;
      state.emptyErrorMessage = null;
      state.loadErrorDetail = message;
      provenanceStrip.innerHTML = renderProvenanceStrip(null, {
        t,
        locale: state.locale,
        loadFailed: true,
      });
      if (options.provenanceNotes) options.provenanceNotes.innerHTML = renderProvenanceNotes(null, { t, locale: state.locale });
      renderLoadError();
    } finally {
      setLoading(false);
      options.renderTarget?.();
      options.renderResearchView?.();
    }
  }

  function renderLoadError(): void {
    const detail = options.state.loadErrorDetail;
    if (!detail) return;
    const errorMessage = runtimeErrorSummary(detail, options.t, "load");
    options.resultsRoot.hidden = true;
    options.emptyState.setAttribute("role", "alert");
    options.emptyState.hidden = false;
    options.emptyState.innerHTML = `
      <div class="empty-content">
        <div class="empty-title">${escapeHtml(errorMessage)}</div>
        <button class="small-button" type="button" data-retry-load>${escapeHtml(options.t("loadIndex"))}</button>
        <details class="error-diagnostics">
          <summary>${escapeHtml(options.t("technicalDetails"))}</summary>
          <code>${escapeHtml(detail)}</code>
        </details>
      </div>
    `;
    options.emptyState.querySelector<HTMLButtonElement>("[data-retry-load]")
      ?.addEventListener("click", (event) => {
        (event.currentTarget as HTMLButtonElement).disabled = true;
        void loadIndex();
      });
  }

  return {
    loadIndex,
    renderLoadError,
  };
}
