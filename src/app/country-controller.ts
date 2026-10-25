import type { AppState } from "./state";
import type { CountryPreset, Locale } from "../shared/types";
import {
  countryPanelMoreItemsLabel,
  countrySelectionCountLabel,
  renderCountryListHtml,
  renderCountryPresetsHtml,
  renderSelectedSummaryHtml,
} from "./country-panel";
import type { TextKey } from "./i18n";
import { bindPresetTooltips } from "./preset-tooltip";
import { bindSelectedCountryRunway } from "./selected-country-runway";

type CountryControllerDeps = {
  state: AppState;
  countryPresets: HTMLDivElement;
  countryList: HTMLDivElement;
  selectedSummary: HTMLDivElement;
  t: (key: TextKey) => string;
  localizedText: (value: CountryPreset["label"], locale?: Locale) => string;
  countryName: (code: string) => string;
  countryFlag: (code: string) => string;
  formatNumber: (value: number) => string;
};

export function createCountryController(deps: CountryControllerDeps) {
  bindPresetTooltips(deps.countryPresets);
  const layoutSelectedCountries = bindSelectedCountryRunway(deps.selectedSummary, count =>
    countryPanelMoreItemsLabel(count, { locale: deps.state.locale, formatNumber: deps.formatNumber }));
  let presetsExpanded = false;
  let previousActivePreset: string | null = null;
  function renderPresetDisclosure(): void {
    deps.countryPresets.classList.toggle("is-expanded", presetsExpanded);
    deps.countryPresets.querySelector("[data-toggle-presets]")?.setAttribute("aria-expanded", String(presetsExpanded));
  }
  deps.countryPresets.addEventListener("click", event => {
    if (!(event.target as HTMLElement).closest("[data-toggle-presets]")) return;
    presetsExpanded = !presetsExpanded;
    renderPresetDisclosure();
  });
  function countryPanelContext() {
    return {
      index: deps.state.index,
      activePreset: deps.state.activePreset,
      selectedCountries: deps.state.selectedCountries,
      countryFilter: deps.state.countryFilter,
      locale: deps.state.locale,
      t: deps.t,
      localizedText: deps.localizedText,
      countryName: deps.countryName,
      countryFlag: deps.countryFlag,
      formatNumber: deps.formatNumber,
    };
  }

  function renderCountryPresets(): void {
    const groups = [...deps.countryPresets.querySelectorAll<HTMLDetailsElement>("[data-preset-group]")];
    const openGroups = new Map(groups.map(group => [group.dataset.presetGroup, group.open]));
    const scrollTop = deps.countryPresets.querySelector(".preset-browser-body")?.scrollTop ?? 0;
    const activeChanged = deps.state.activePreset && deps.state.activePreset !== previousActivePreset;
    deps.countryPresets.innerHTML = renderCountryPresetsHtml(countryPanelContext());
    for (const group of deps.countryPresets.querySelectorAll<HTMLDetailsElement>("[data-preset-group]")) {
      if (openGroups.has(group.dataset.presetGroup)) group.open = openGroups.get(group.dataset.presetGroup)!;
      if (activeChanged && group.querySelector('[aria-pressed="true"]')) group.open = true;
    }
    previousActivePreset = deps.state.activePreset;
    renderPresetDisclosure();
    const body = deps.countryPresets.querySelector(".preset-browser-body");
    if (body) body.scrollTop = scrollTop;
  }

  function renderSelectedSummary(): void {
    deps.selectedSummary.innerHTML = renderSelectedSummaryHtml(countryPanelContext());
    layoutSelectedCountries();
    const counter = document.getElementById("picker-selected-count");
    if (counter) counter.textContent = `${deps.t("selectedCountries")}: ${deps.formatNumber(deps.state.selectedCountries.size)}`;
    const listCounter = deps.countryList.querySelector("[data-country-selection-count]");
    if (listCounter) listCounter.textContent = countrySelectionCountLabel(countryPanelContext());
  }

  return {
    renderCountries(): void {
      renderSelectedSummary();
      renderCountryPresets();
      deps.countryList.innerHTML = renderCountryListHtml(countryPanelContext());
    },
    renderCountryPresets,
    renderSelectedSummary,
    moreItemsLabel(count: number): string {
      return countryPanelMoreItemsLabel(count, {
        locale: deps.state.locale,
        formatNumber: deps.formatNumber,
      });
    },
  };
}
