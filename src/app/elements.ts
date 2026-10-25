import { byId } from "./dom";
import type { TextKey } from "./i18n";
import { renderAppShell } from "./shell";

export type AppElements = {
  app: HTMLDivElement;
  researchViewButtons: NodeListOf<HTMLButtonElement>;
  timeWorkspace: HTMLElement;
  profileWorkspace: HTMLElement;
  countryEvidenceWorkspace: HTMLElement;
  countryOverviewWorkspace: HTMLElement;
  profileContent: HTMLDivElement;
  countryEvidenceContent: HTMLDivElement;
  countryOverviewContent: HTMLDivElement;
  countryOverviewSelect: HTMLSelectElement;
  exportButton: HTMLButtonElement;
  selectionPanel: HTMLDialogElement;
  selectionPanelToggle: HTMLButtonElement;
  selectionPanelClose: HTMLButtonElement;
  selectionPanelDone: HTMLButtonElement;
  selectedCountryScope: HTMLElement;
  selectedCountryFlags: HTMLElement;
  selectedCountryMore: HTMLElement;
  localeSwitcher: HTMLSelectElement;
  countrySearch: HTMLInputElement;
  countryPresets: HTMLDivElement;
  countryList: HTMLDivElement;
  selectedSummary: HTMLDivElement;
  targetYear: HTMLInputElement;
  targetEra: HTMLButtonElement;
  targetSlider: HTMLInputElement;
  targetDensity: HTMLDivElement;
  targetDensitySummary: HTMLDivElement;
  maxDeltaInput: HTMLInputElement;
  minResultSamplesInput: HTMLInputElement;
  presenceToggle: HTMLButtonElement;
  includeCrossingInput: HTMLInputElement;
  resultsRoot: HTMLDivElement;
  emptyState: HTMLDivElement;
  provenanceStrip: HTMLElement;
  provenanceNotes: HTMLElement;
  resultHead: HTMLTableRowElement;
  resultBody: HTMLTableSectionElement;
  resultMacroGroupControl: HTMLLabelElement;
  resultMacroGroupFilter: HTMLSelectElement;
  crossingMacroGroupControl: HTMLLabelElement;
  crossingMacroGroupFilter: HTMLSelectElement;
  crossingResultsSection: HTMLElement;
  crossingResultHead: HTMLTableRowElement;
  crossingResultBody: HTMLTableSectionElement;
};

export function createAppElements(t: (key: TextKey) => string): AppElements {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) {
    throw new Error("Missing #app element.");
  }

  app.innerHTML = renderAppShell(t);

  // Keep the shared picker outside workspaces so navigation cannot hide it.
  const selectionPanel = byId<HTMLDialogElement>("selection-panel");
  app.append(selectionPanel);

  return {
    app,
    researchViewButtons: document.querySelectorAll<HTMLButtonElement>("[data-research-view]"),
    timeWorkspace: byId<HTMLElement>("time-workspace"),
    profileWorkspace: byId<HTMLElement>("profile-workspace"),
    countryEvidenceWorkspace: byId<HTMLElement>("country-evidence-workspace"),
    countryOverviewWorkspace: byId<HTMLElement>("country-overview-workspace"),
    profileContent: byId<HTMLDivElement>("profile-content"),
    countryEvidenceContent: byId<HTMLDivElement>("country-evidence-content"),
    countryOverviewContent: byId<HTMLDivElement>("country-overview-content"),
    countryOverviewSelect: byId<HTMLSelectElement>("country-overview-select"),
    exportButton: byId<HTMLButtonElement>("export-csv"),
    selectionPanel,
    selectionPanelToggle: byId<HTMLButtonElement>("selection-panel-toggle"),
    selectionPanelClose: byId<HTMLButtonElement>("selection-panel-close"),
    selectionPanelDone: byId<HTMLButtonElement>("selection-panel-done"),
    selectedCountryScope: byId<HTMLElement>("selected-country-scope"),
    selectedCountryFlags: byId<HTMLElement>("selected-country-flags"),
    selectedCountryMore: byId<HTMLElement>("selected-country-more"),
    localeSwitcher: byId<HTMLSelectElement>("locale-switcher"),
    countrySearch: byId<HTMLInputElement>("country-search"),
    countryPresets: byId<HTMLDivElement>("country-presets"),
    countryList: byId<HTMLDivElement>("country-list"),
    selectedSummary: byId<HTMLDivElement>("selected-summary"),
    targetYear: byId<HTMLInputElement>("target-year"),
    targetEra: byId<HTMLButtonElement>("target-era"),
    targetSlider: byId<HTMLInputElement>("target-slider"),
    targetDensity: byId<HTMLDivElement>("target-density"),
    targetDensitySummary: byId<HTMLDivElement>("target-density-summary"),
    maxDeltaInput: byId<HTMLInputElement>("max-delta-ybp"),
    minResultSamplesInput: byId<HTMLInputElement>("min-result-samples"),
    presenceToggle: byId<HTMLButtonElement>("presence-mode-toggle"),
    includeCrossingInput: byId<HTMLInputElement>("include-crossing"),
    resultsRoot: byId<HTMLDivElement>("results"),
    emptyState: byId<HTMLDivElement>("empty-state"),
    provenanceStrip: byId<HTMLElement>("provenance-strip"),
    provenanceNotes: byId<HTMLElement>("provenance-notes"),
    resultHead: byId<HTMLTableRowElement>("result-head"),
    resultBody: byId<HTMLTableSectionElement>("result-body"),
    resultMacroGroupControl: byId<HTMLLabelElement>("result-macrogroup-control"),
    resultMacroGroupFilter: byId<HTMLSelectElement>("result-macrogroup-filter"),
    crossingMacroGroupControl: byId<HTMLLabelElement>("crossing-macrogroup-control"),
    crossingMacroGroupFilter: byId<HTMLSelectElement>("crossing-macrogroup-filter"),
    crossingResultsSection: byId<HTMLElement>("crossing-results-section"),
    crossingResultHead: byId<HTMLTableRowElement>("crossing-result-head"),
    crossingResultBody: byId<HTMLTableSectionElement>("crossing-result-body"),
  };
}
