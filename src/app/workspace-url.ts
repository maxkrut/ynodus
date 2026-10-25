import type { AppState } from "./state";
import { createInitialState } from "./state";
import type { AppElements } from "./elements";
import { DEFAULT_TARGET_YEAR, MAX_QUERY_YBP } from "./constants";
import { calendarYearToYbp } from "../shared/time";
import { COUNTRY_PRESET_MAP } from "./presets";
import { routeFromUrl } from "./research-history";
import { translate } from "./i18n";
import { availablePresetCountries, sameCountrySelection } from "./query-model";
import type { Locale } from "../shared/types";

/** Public query settings only; never sample identities or worker result payloads. */
export function createWorkspaceUrl(state: AppState, startupLocale?: Locale) {
  let ready = false;
  let invalidLink = false;
  const initialRoute = routeFromUrl(new URL(location.href));
  state.researchView = initialRoute.view;
  const initialTarget = readSettings();

  function integer(params: URLSearchParams, key: string, fallback: number, max: number): number {
    const raw = params.get(key);
    if (raw === null) return fallback;
    if (!/^\d{1,16}$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) > max) {
      invalidLink = true;
      return fallback;
    }
    return Number(raw);
  }
  function readSettings(restoreLocale = true): number {
    const params = new URL(location.href).searchParams;
    const defaults = createInitialState();
    const lang = params.get("lang");
    // A direct link sets the initial language; Back/Forward keeps the user's current choice.
    if (restoreLocale) {
      state.locale = startupLocale ?? (lang === "en" || lang === "ru" ? lang : defaults.locale);
      if (lang !== null && lang !== "en" && lang !== "ru") invalidLink = true;
    }
    state.maxDeltaYbp = integer(params, "window", defaults.maxDeltaYbp, MAX_QUERY_YBP);
    state.minResultSamples = integer(params, "min", defaults.minResultSamples, Number.MAX_SAFE_INTEGER);
    state.includeCrossing = params.get("crossing") === "1";
    state.presenceMode = params.get("presence") === "any" ? "any" : "all";
    const countries = params.get("countries");
    if (countries === null) state.selectedCountries = defaults.selectedCountries;
    else {
      const codes = countries ? countries.split(",") : [];
      state.selectedCountries = new Set(codes.slice(0, 250).filter((code) => /^[A-Z]{3}$/.test(code)));
      if (codes.length > 250 || codes.some((code) => !/^[A-Z]{3}$/.test(code))) invalidLink = true;
    }
    const preset = params.get("preset");
    state.activePreset = preset && COUNTRY_PRESET_MAP.has(preset) ? preset : countries === null ? defaults.activePreset : null;
    if (preset !== null && !COUNTRY_PRESET_MAP.has(preset)) invalidLink = true;
    if (params.has("branch")) invalidLink = true;
    return integer(params, "target", calendarYearToYbp(-DEFAULT_TARGET_YEAR), MAX_QUERY_YBP);
  }
  function syncInputs(elements: AppElements, setTarget: (ybp: number) => void, target: number): void {
    setTarget(target);
    elements.maxDeltaInput.value = String(state.maxDeltaYbp);
    elements.minResultSamplesInput.value = String(state.minResultSamples);
  }
  function showNote(): void {
    const note = document.getElementById("workspace-link-note");
    if (!note) return;
    note.hidden = !invalidLink;
    note.textContent = translate(state.locale, "workspaceLinkAdjusted");
  }
  function validateCountries(): void {
    if (!state.index) return;
    const available = state.index.countries;
    for (const code of state.selectedCountries) {
      if (!available.has(code)) { state.selectedCountries.delete(code); invalidLink = true; }
    }
    const preset = state.activePreset && COUNTRY_PRESET_MAP.get(state.activePreset);
    if (preset && !sameCountrySelection(state.selectedCountries, availablePresetCountries(state.index, preset))) {
      state.activePreset = null;
      invalidLink = true;
    }
    showNote();
  }
  return {
    initialRoute,
    initialize(elements: AppElements, setTarget: (ybp: number) => void) {
      syncInputs(elements, setTarget, initialTarget);
    },
    async onIndexReady() {
      validateCountries();
      ready = true;
    },
    async restore(elements: AppElements, setTarget: (ybp: number) => void) {
      ready = false;
      invalidLink = false;
      syncInputs(elements, setTarget, readSettings(false));
      validateCountries();
      ready = !!state.index;
      showNote();
    },
    persist(targetYbp: number) {
      showNote();
      if (!ready) return;
      const url = new URL(location.href);
      const values = {
        lang: state.locale, target: String(targetYbp), window: String(state.maxDeltaYbp),
        min: String(state.minResultSamples), presence: state.presenceMode,
        crossing: state.includeCrossing ? "1" : "0", countries: [...state.selectedCountries].sort().join(","),
      };
      for (const [key, value] of Object.entries(values)) url.searchParams.set(key, value);
      url.searchParams.delete("branch");
      if (state.activePreset) url.searchParams.set("preset", state.activePreset);
      else url.searchParams.delete("preset");
      if (url.href !== location.href) history.replaceState(history.state, "", url);
    },
  };
}
