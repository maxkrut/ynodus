import type { AppEventBindings } from "./event-bindings";
import { COUNTRY_PRESET_MAP } from "./presets";
import { availablePresetCountries, normalizeMinResultSamples } from "./query-model";

export function bindCountryEvents(bindings: AppEventBindings): void {
  const {
    state,
    elements,
    queueAnalysis,
    renderCountries,
    renderCountryPresets,
    renderStats,
  } = bindings;

  const renderSelectionChrome = (): void => {
    renderCountryPresets();
    renderStats();
    bindings.renderPresenceMode();
  };

  const focusCountrySearch = (): void => {
    queueMicrotask(() => elements.countrySearch.focus());
  };

  elements.countrySearch.addEventListener("input", () => {
    state.countryFilter = elements.countrySearch.value;
    renderCountries();
  });

  elements.minResultSamplesInput.addEventListener("input", () => {
    const rawValue = elements.minResultSamplesInput.value.trim();
    if (rawValue === "") { queueAnalysis(); return; }
    const next = normalizeMinResultSamples(Number(rawValue));
    if (rawValue !== String(next)) elements.minResultSamplesInput.value = String(next);
    if (state.minResultSamples === next && state.committedQuery) return;
    state.minResultSamples = next;
    queueAnalysis();
  });

  elements.minResultSamplesInput.addEventListener("blur", () => {
    const wasEmpty = elements.minResultSamplesInput.value.trim() === "";
    elements.minResultSamplesInput.value = String(state.minResultSamples);
    if (wasEmpty) queueAnalysis();
  });

  elements.countryList.addEventListener("change", (event) => {
    const input = (event.target as HTMLElement).closest<HTMLInputElement>(
      "input[data-country-code]",
    );
    if (!input) return;

    const code = input.dataset.countryCode ?? input.value;
    if (input.checked) state.selectedCountries.add(code);
    else state.selectedCountries.delete(code);
    state.activePreset = null;
    queueAnalysis();
    renderSelectionChrome();
  });

  elements.countryList.addEventListener("click", (event) => {
    const actionButton = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-country-action]",
    );
    const action = actionButton?.dataset.countryAction;
    if (action !== "all" && action !== "none") return;

    if (action === "all") {
      if (!state.index) return;
      state.selectedCountries = new Set(state.index.countries.keys());
    } else {
      state.selectedCountries.clear();
    }
    state.activePreset = null;
    queueAnalysis();
    renderCountries();
    renderSelectionChrome();
    focusCountrySearch();
  });

  elements.countryPresets.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;

    const option = target.closest<HTMLButtonElement>("[data-country-preset-option]");
    const presetKey = option?.dataset.countryPresetOption;
    if (presetKey) applyPreset(presetKey);
  });

  elements.selectedSummary.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-remove-country]",
    );
    if (!button) return;
    const code = button.dataset.removeCountry;
    if (!code) return;

    state.selectedCountries.delete(code);
    state.activePreset = null;
    queueAnalysis();
    renderCountries();
    renderSelectionChrome();
    queueMicrotask(() => {
      const nextRemoveButton = elements.selectedSummary.querySelector<HTMLButtonElement>(
        "[data-remove-country]",
      );
      if (nextRemoveButton) nextRemoveButton.focus();
      else elements.countrySearch.focus();
    });
  });

  function applyPreset(presetKey: string): void {
    const preset = COUNTRY_PRESET_MAP.get(presetKey);
    if (!preset) return;
    const nextCountries = new Set(availablePresetCountries(state.index, preset));
    const selectionChanged = !sameSet(state.selectedCountries, nextCountries);
    state.activePreset = preset.key;
    state.selectedCountries = nextCountries;
    if (selectionChanged) queueAnalysis();
    renderCountries();
    renderSelectionChrome();
    focusCountrySearch();
  }
}

function sameSet(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}
