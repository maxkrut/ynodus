import { escapeHtml } from "../shared/html";
import type { Locale } from "../shared/types";
import type { AppElements } from "./elements";
import type { TextKey } from "./i18n";
import type { createResearchMarkup } from "./research-markup";
import type { AppState } from "./state";

type Options = {
  state: AppState;
  elements: AppElements;
  markup: ReturnType<typeof createResearchMarkup>;
  t: (key: TextKey) => string;
  countryName: (code: string) => string;
  locale: () => Locale;
};

export function renderCountryOverviewView(options: Options): void {
  const { state, elements, markup } = options;
  if (state.researchView !== "country-overview") {
    elements.countryOverviewContent.replaceChildren();
    return;
  }
  if (state.researchBusy) elements.countryOverviewContent.innerHTML = markup.loading();
  else if (state.researchError) elements.countryOverviewContent.innerHTML = markup.error(state.researchError);
  else elements.countryOverviewContent.innerHTML = state.countryOverview
    ? markup.countryOverview(state.countryOverview)
    : "";
}

export function renderCountryOverviewOptions(options: Options): void {
  const { state, elements } = options;
  const selected = state.countryOverview?.country ?? elements.countryOverviewSelect.value;
  const entries = [...(state.index?.countries.keys() ?? [])].sort((left, right) =>
    options.countryName(left).localeCompare(options.countryName(right), options.locale()));
  elements.countryOverviewSelect.innerHTML = entries.map((code) =>
    `<option value="${escapeHtml(code)}">${escapeHtml(options.countryName(code))} · ${escapeHtml(code)}</option>`).join("");
  elements.countryOverviewSelect.disabled = entries.length === 0;
  if (selected && entries.includes(selected)) elements.countryOverviewSelect.value = selected;
}
