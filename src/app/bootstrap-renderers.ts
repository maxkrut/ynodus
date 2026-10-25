import { defaultTableSortDirection } from "../results/sorting";
import { pluralLabel } from "../shared/plural";
import type { CountryPreset, Locale, SliceMode, TableSortKey } from "../shared/types";
import { TABLE_INITIAL_ROW_LIMIT } from "./constants";
import { setText } from "./dom";
import type { AppElements } from "./elements";
import type { TextKey } from "./i18n";
import {
  renderCrossingOptionControl,
  renderPresenceModeControls,
} from "./mode-controls";
import { COUNTRY_PRESET_MAP } from "./presets";
import { renderQueryChips } from "./query-chips";
import type { AppState } from "./state";

const SELECTED_COUNTRY_PREVIEW_LIMIT = 3;

type BootstrapRendererOptions = {
  state: AppState;
  elements: AppElements;
  t: (key: TextKey) => string;
  localizedText: (value: CountryPreset["label"], locale?: Locale) => string;
  countryName: (code: string) => string;
  countryFlag: (code: string) => string;
  formatNumber: (value: number) => string;
  renderSelectedSummary: () => void;
  renderResultTable: (preserveExpanded?: boolean, sliceMode?: SliceMode) => void;
};

export function createBootstrapRenderers(options: BootstrapRendererOptions) {
  const { state, elements } = options;

  function countryCountText(count: number): string {
    const noun = pluralLabel(
      state.locale,
      count,
      options.t("country"),
      options.t("countriesFew"),
      options.t("countriesPlural"),
    );
    return `${options.formatNumber(count)} ${noun}`;
  }

  function setTableSort(key: TableSortKey, mode: SliceMode): void {
    const sort = mode === "crossing" ? state.crossingTableSort : state.tableSort;
    if (sort.key === key) {
      sort.direction = sort.direction === "asc" ? "desc" : "asc";
    } else {
      sort.key = key;
      sort.direction = defaultTableSortDirection(key);
    }
    if (mode === "crossing") state.crossingTableRowLimit = TABLE_INITIAL_ROW_LIMIT;
    else state.tableRowLimit = TABLE_INITIAL_ROW_LIMIT;
    options.renderResultTable(false, mode);
    const head = mode === "crossing" ? elements.crossingResultHead : elements.resultHead;
    head.querySelector<HTMLButtonElement>(`[data-table-sort="${key}"]`)?.focus();
  }

  function renderQueryChipLabels(): void {
    renderQueryChips({
      presenceMode: state.presenceMode,
      selectedCountries: state.selectedCountries,
      activePreset: state.activePreset,
      includeCrossing: state.includeCrossing,
      t: options.t,
      formatNumber: options.formatNumber,
      localizedText: options.localizedText,
      countNoun: (count, one, few, many) => pluralLabel(state.locale, count, one, few, many),
    });
  }

  function renderPresenceMode(): void {
    renderPresenceModeControls(elements.presenceToggle, state.presenceMode, { t: options.t });
    const presenceControl = document.getElementById("query-presence-control");
    if (presenceControl) presenceControl.hidden = state.selectedCountries.size === 0;
    elements.presenceToggle.disabled = false;
    renderQueryChipLabels();
  }

  function renderSliceMode(): void {
    renderCrossingOptionControl(elements.includeCrossingInput, state.includeCrossing, { t: options.t });
    renderQueryChipLabels();
  }

  function renderStats(): void {
    renderSelectedCountriesHeadline();
    const selected = state.selectedCountries.size;
    setText("stat-selected", options.formatNumber(selected));
    setText(
      "stat-selected-label",
      pluralLabel(state.locale, selected, options.t("country"), options.t("countriesFew"), options.t("countriesPlural")),
    );
    options.renderSelectedSummary();
    renderQueryChipLabels();
  }

  function renderSelectedCountriesHeadline(): void {
    const selected = [...state.selectedCountries];
    const preview = selected.slice(0, SELECTED_COUNTRY_PREVIEW_LIMIT);
    const remaining = Math.max(0, selected.length - preview.length);
    elements.selectedCountryFlags.innerHTML = preview
      .map((code) => `<span class="mockup-selected-country-flag" aria-hidden="true">${options.countryFlag(code)}</span>`)
      .join("");
    elements.selectedCountryMore.textContent = `+${options.formatNumber(remaining)}`;
    elements.selectedCountryMore.hidden = remaining === 0;
    elements.selectionPanelToggle.classList.toggle("is-empty", selected.length === 0);

    const preset = state.activePreset ? COUNTRY_PRESET_MAP.get(state.activePreset) : null;
    const scopeLabel = preset
      ? `${options.t("presetActive")}: ${options.localizedText(preset.label)}`
      : options.t("selectedCountries");
    elements.selectedCountryScope.textContent = preset
      ? options.localizedText(preset.label)
      : options.t("selectedCountries");

    const previewNames = preview.map(options.countryName).join(", ");
    const remainingLabel = remaining > 0
      ? `, ${options.t("andMoreCountries")} ${options.formatNumber(remaining)}`
      : "";
    const accessibleSummary = selected.length === 0
      ? `${options.t("openCountryPicker")}. ${options.t("noCountriesSelected")}`
      : `${options.t("openCountryPicker")}. ${scopeLabel}. ${countryCountText(selected.length)}: ${previewNames}${remainingLabel}`;
    document.getElementById("selected-country-accessible-summary")!.textContent = accessibleSummary;
    elements.selectionPanelToggle.title = accessibleSummary;
  }

  return {
    setTableSort,
    renderQueryChipLabels,
    renderPresenceMode,
    renderSliceMode,
    renderStats,
  };
}
