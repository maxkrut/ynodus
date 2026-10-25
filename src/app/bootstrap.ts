import { bindSampleScope } from "./sample-scope";
import {
  DATA_URL,
  WORKER_REQUEST_TIMEOUT_MS,
} from "./constants";
import { createAnalysisController } from "./analysis-controller";
import { createAppStatusController } from "./app-status";
import { createBootstrapRenderers } from "./bootstrap-renderers";
import { countryFlag as countryFlagForLocale, countryName as countryNameForLocale } from "./countries";
import {
  createCountryController,
} from "./country-controller";
import { createAppElements } from "./elements";
import { bindAppEvents } from "./events";
import { formatCalendar as formatCalendarForLocale, formatNumber as formatNumberForLocale } from "./format";
import { localizedText as localizedTextForLocale, translate, type TextKey } from "./i18n";
import { createAppLifecycle } from "./lifecycle";
import { createLocaleController } from "./locale-controller";
import { readLocalePreference } from "./locale-preference";
import { createResultsController } from "./results-controller";
import { createResearchController } from "./research-controller";
import { closeDialogsForNavigation } from "./dialog-focus";
import { createInitialState } from "./state";
import { createWorkspaceUrl } from "./workspace-url";
import { routeFromUrl } from "./research-history";
import { timeQuerySettingsKey } from "./query-model";
import { createTargetController } from "./target-controller";
import { createWorkerClient } from "./worker-client";
import type {
  CountryPreset,
  Locale,
} from "../shared/types";

export function startApp(): void {
  const state = createInitialState();
  const workspaceUrl = createWorkspaceUrl(state, readLocalePreference() ?? undefined);

  const elements = createAppElements(t);
  const {
    exportButton,
    localeSwitcher,
    countryPresets,
    countryList,
    selectedSummary,
    targetYear,
    targetEra,
    targetSlider,
    targetDensity,
    targetDensitySummary,
    resultsRoot,
    emptyState,
    provenanceStrip,
    provenanceNotes,
    resultHead,
    resultBody,
    resultMacroGroupControl,
    resultMacroGroupFilter,
    crossingMacroGroupControl,
    crossingMacroGroupFilter,
    crossingResultsSection,
    crossingResultHead,
    crossingResultBody,
  } = elements;

  const countryController = createCountryController({
    state,
    countryPresets,
    countryList,
    selectedSummary,
    t,
    localizedText,
    countryName,
    countryFlag,
    formatNumber,
  });
  const renderCountries = countryController.renderCountries;
  const renderCountryPresets = countryController.renderCountryPresets;
  const renderSelectedSummary = countryController.renderSelectedSummary;
  const moreItemsLabel = countryController.moreItemsLabel;
  const targetController = createTargetController({
    state,
    workerClient: () => workerClient,
    locale: () => state.locale,
    targetYear,
    targetEra,
    targetSlider,
    targetDensity,
    targetDensitySummary,
    t,
    formatNumber,
  });
  const renderTarget = targetController.renderTarget;
  const setTargetFromYbp = targetController.setTargetFromYbp;
  const targetYbp = targetController.targetYbp;
  const appStatus = createAppStatusController({
    state,
    t,
  });
  const {
    renderLiveStatus,
    setEmpty,
    setLoading,
  } = appStatus;
  const resultsController = createResultsController({
    state,
    exportButton,
    resultsRoot,
    emptyState,
    resultHead,
    resultBody,
    resultMacroGroupControl,
    resultMacroGroupFilter,
    crossingMacroGroupControl,
    crossingMacroGroupFilter,
    crossingResultsSection,
    crossingResultHead,
    crossingResultBody,
    targetYbp,
    t,
    formatNumber,
    formatCalendar,
    countryFlag,
    subcladeUrl,
    moreItemsLabel,
  });
  let restoreResearchPosition: (() => void) | undefined;
  const renderResults = () => { resultsController.renderResults(); restoreResearchPosition?.(); };
  const renderResultTable = resultsController.renderResultTable;
  const renderPendingResults = resultsController.renderPendingResults;
  const renderers = createBootstrapRenderers({
    state,
    elements,
    t,
    localizedText,
    countryName,
    countryFlag,
    formatNumber,
    renderSelectedSummary,
    renderResultTable,
  });
  const {
    setTableSort,
    renderQueryChipLabels,
    renderPresenceMode,
    renderSliceMode,
    renderStats,
  } = renderers;

  const analysisWorker = new Worker(new URL("../analysis-worker.ts", import.meta.url), {
    type: "module",
  });
  const workerClient = createWorkerClient(analysisWorker, WORKER_REQUEST_TIMEOUT_MS);
  const analysisController = createAnalysisController({
    state,
    densityIntervals: targetController.densityIntervals,
    workerClient,
    exportButton,
    resultsRoot,
    emptyState,
    captureCommittedQuery: () => ({
      selectedCountries: [...state.selectedCountries].sort(),
      presenceMode: state.presenceMode,
      includeCrossing: state.includeCrossing,
      minResultSamples: state.minResultSamples,
      maxDeltaYbp: state.maxDeltaYbp,
      targetYbp: targetYbp(),
      targetYear: targetYear.value,
      targetEra: targetEra.value,
      provenance: state.index ? {
        version: state.index.version, officialVersion: state.index.officialVersion,
        computedDate: state.index.computedDate, generatedAt: state.index.generatedAt,
        sourceUrl: state.index.sourceUrl, sourceManifestUrl: state.index.sourceManifestUrl,
        format: state.index.format, sampleScope: state.index.sampleScope,
      } : undefined,
    }),
    hasQueryDraft: () => [targetYear, elements.maxDeltaInput, elements.minResultSamplesInput]
      .some((input) => input.value.trim() === ""),
    t,
    setEmpty,
    renderTarget,
    renderStats,
    renderLiveStatus,
    renderPendingResults,
    renderResults: () => {
      renderResults();
      if (state.researchView === "profile" && state.resultDetail) researchController.render();
    },
  });
  const queueAnalysis = (): void => {
    workspaceUrl.persist(targetYbp());
    analysisController.queueAnalysis();
  };
  const researchController = createResearchController({
    renderTimeResults: renderResults,
    dismissDialogs: closeDialogsForNavigation,
    initialRoute: workspaceUrl.initialRoute,
    restoreQuery: async () => {
      const before = timeQuerySettingsKey(state, targetYbp());
      const hadDraft = [targetYear, elements.maxDeltaInput, elements.minResultSamplesInput]
        .some(input => input.value.trim() === "");
      await workspaceUrl.restore(elements, setTargetFromYbp);
      if (hadDraft || before !== timeQuerySettingsKey(state, targetYbp())) queueAnalysis();
      applyLocale();
    },
    state,
    locale: () => state.locale,
    elements,
    workerClient,
    t,
    formatCalendar,
    formatNumber,
    countryName,
    countryFlag,
    subcladeUrl,
    setTargetFromYbp,
    queueAnalysis,
  });
  restoreResearchPosition = researchController.restorePosition;
  const lifecycle = createAppLifecycle({
    state,
    workerClient,
    // Resolve in the document context before crossing the Worker boundary.
    // A relative URL inside a Worker is otherwise based on the worker script
    // (/src in dev and /assets in production), not on the application page.
    dataUrl: new URL(DATA_URL, document.baseURI).href,
    exportButton,
    resultsRoot,
    emptyState,
    provenanceStrip,
    provenanceNotes,
    t,
    setLoading,
    invalidateAnalysisRequests: analysisController.invalidateRequests,
    onIndexReady: async () => {
      await workspaceUrl.onIndexReady();
      const route = routeFromUrl(new URL(location.href));
      if (route.view !== "time" || state.researchView !== "time") {
        await researchController.restoreRoute(route);
      }
      applyLocale();
    },
    renderResearchView: researchController.render,
    renderTarget,
    renderCountries,
    renderStats,
    queueAnalysis,
  });
  const loadIndex = lifecycle.loadIndex;
  const localeController = createLocaleController({
    state,
    localeSwitcher,
    exportButton,
    provenanceStrip,
    provenanceNotes,
    t,
    setLoading,
    setEmpty,
    renderLoadError: lifecycle.renderLoadError,
    renderPresenceMode,
    renderSliceMode,
    renderTarget,
    renderLiveStatus,
    renderCountries,
    renderStats,
    renderResults,
    renderPendingResults,
    renderResearchView: researchController.render,
  });
  const applyLocale = (): void => {
    localeController.applyLocale();
    workspaceUrl.persist(targetYbp());
  };

  workspaceUrl.initialize(elements, setTargetFromYbp);
  bindAppEvents({
    state,
    elements,
    t,
    formatCalendar,
    subcladeUrl,
    applyLocale,
    queueAnalysis,
    setTableSort,
    handleTargetChange,
    previewTargetChange,
    targetYbp,
    setTargetFromYbp,
    renderCountries,
    renderCountryPresets,
    renderSelectedSummary,
    renderStats,
    renderResults,
    renderResultTable,
    renderTarget,
    renderSliceMode,
    renderPresenceMode,
    showResearchView: researchController.showView,
    loadProfile: researchController.loadProfile,
    loadResultDetail: researchController.loadResultDetail,
    loadCountryEvidence: researchController.loadCountryEvidence,
    loadCountryOverview: researchController.loadCountryOverview,
    backFromCountryEvidence: researchController.backFromCountryEvidence,
    backResearchView: researchController.back,
    searchNearProfileFormation: researchController.searchNearProfileFormation,
    revealEvidence: researchController.revealEvidence,
  });

  renderCountries();
  renderStats();
  renderTarget();
  renderPresenceMode();
  renderSliceMode();
  renderQueryChipLabels();
  researchController.render();
  applyLocale();
  bindSampleScope();
  void loadIndex();

  function handleTargetChange(source: "fields" | "slider"): void {
    targetController.handleTargetInput(source);
    renderQueryChipLabels();
    queueAnalysis();
  }

  function previewTargetChange(source: "fields" | "slider"): void {
    targetController.handleTargetInput(source, true);
    analysisController.previewAnalysis();
  }

  function t(key: TextKey): string {
    return translate(state.locale, key);
  }

  function localizedText(value: CountryPreset["label"], locale: Locale = state.locale): string {
    return localizedTextForLocale(value, locale);
  }

  function countryName(code: string): string {
    return countryNameForLocale(code, state.locale);
  }

  function countryFlag(code: string): string {
    return countryFlagForLocale(code, state.locale);
  }

  function formatCalendar(ybp: number): string {
    return formatCalendarForLocale(ybp, state.locale, formatNumber);
  }

  function formatNumber(value: number): string {
    return formatNumberForLocale(value, state.locale);
  }
}

function subcladeUrl(id: string): string {
  const normalized = id.trim();
  if (!normalized) return "";
  return `https://www.yfull.com/tree/${encodeURIComponent(normalized)}/`;
}
