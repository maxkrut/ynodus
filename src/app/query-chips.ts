import type { PresenceMode, CountryPreset } from "../shared/types";
import { byId } from "./dom";
import type { TextKey } from "./i18n";
import { COUNTRY_PRESET_MAP } from "./presets";

type QueryChipContext = {
  presenceMode: PresenceMode;
  selectedCountries: Set<string>;
  activePreset: string | null;
  includeCrossing: boolean;
  t: (key: TextKey) => string;
  formatNumber: (value: number) => string;
  localizedText: (value: CountryPreset["label"]) => string;
  countNoun: (count: number, one: string, few: string, many: string) => string;
};

export function renderQueryChips(context: QueryChipContext): void {
  const selected = context.selectedCountries.size;
  const preset = context.activePreset ? COUNTRY_PRESET_MAP.get(context.activePreset) : null;
  const countryWord = context.countNoun(
    selected,
    context.t("country"),
    context.t("countriesFew"),
    context.t("countriesPlural"),
  );
  const countriesLabel = selected === 0
    ? context.t("queryCountriesEmpty")
    : preset
      ? `${context.formatNumber(selected)} ${countryWord} · ${context.localizedText(preset.label)}`
      : `${context.formatNumber(selected)} ${countryWord}`;
  byId("query-chip-countries").textContent = countriesLabel;
  const summary = byId("country-condition-summary");
  summary.hidden = true;
  summary.textContent = "";

  byId("query-crossing-control").classList.toggle("is-on", context.includeCrossing);

  byId("query-presence-control").hidden = selected === 0;

  const countriesChip = byId<HTMLButtonElement>("selection-panel-toggle");
  countriesChip.classList.toggle("is-on", selected > 0);
  countriesChip.classList.toggle("is-empty", selected === 0);

}
