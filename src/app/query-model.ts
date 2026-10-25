import type {
  CountryPreset,
  TreeIndexSummary as TreeIndex,
} from "../shared/types";
import type { AppState } from "./state";

type AnalysisCountryScope = {
  selectedCountries: string[];
  scopeAllCountries: boolean;
};

/** Presentation, locale and the research route do not invalidate time results. */
export function timeQuerySettingsKey(state: Pick<AppState,
  "selectedCountries" | "presenceMode" | "includeCrossing" | "minResultSamples" | "maxDeltaYbp"
>, targetYbp: number): string {
  return JSON.stringify([targetYbp, state.maxDeltaYbp, state.minResultSamples,
    state.includeCrossing, state.presenceMode, [...state.selectedCountries].sort()]);
}

export function normalizeMinResultSamples(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

export function availablePresetCountries(
  index: TreeIndex | null,
  preset: CountryPreset,
): string[] {
  if (!index) return [...preset.countries];
  return preset.countries.filter((code) => index.countries.has(code));
}

export function sameCountrySelection(
  selectedCountries: ReadonlySet<string>,
  expectedCountries: readonly string[],
): boolean {
  if (selectedCountries.size !== expectedCountries.length) return false;
  for (const code of expectedCountries) {
    if (!selectedCountries.has(code)) return false;
  }
  return true;
}

export function normalizeCountrySearch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLocaleLowerCase();
}

export function retainAvailableCountries(
  index: TreeIndex,
  selectedCountries: ReadonlySet<string>,
): Set<string> {
  return new Set([...selectedCountries].filter((code) => index.countries.has(code)));
}

export function analysisCountryScope(
  selectedCountries: ReadonlySet<string>,
): AnalysisCountryScope {
  return {
    selectedCountries: [...selectedCountries].sort(),
    scopeAllCountries: false,
  };
}

export function analysisScopeIsValid(
  selectedCountries: ReadonlySet<string>,
): boolean {
  return selectedCountries.size > 0;
}

export function cohortSampleCount(
  index: TreeIndex | null,
  selectedCountries: ReadonlySet<string>,
): number {
  if (!index) return 0;

  let total = 0;
  for (const code of selectedCountries) total += index.countries.get(code) ?? 0;
  return total;
}
