import type { TextKey } from "./i18n";
import type { AppState } from "./state";
import { byId } from "./dom";
import {
  renderLiveStatusState,
  setEmptyMessage,
} from "./status-view";

type AppStatusOptions = {
  state: AppState;
  t: (key: TextKey) => string;
};

export function createAppStatusController({
  state,
  t,
}: AppStatusOptions) {
  function setLoading(loading: boolean): void {
    state.loading = loading;
    if (loading && state.index === null) setEmptyMessage(t("loading"));
  }

  function renderLiveStatus(): void {
    renderLiveStatusState(state.analysisBusy, { t }, state.committedQuery !== null);
    const fixed = document.getElementById("country-fixed-scope-note");
    if (fixed) {
      const codes = state.countryParticipation?.formed ?? [];
      fixed.hidden = state.presenceMode !== "all" || state.minResultSamples <= 0 || !codes.length;
      const copy = fixed.querySelector<HTMLElement>("[data-fixed-scope-copy]");
      if (copy) copy.textContent = t("freezeCountriesScope").replace("{countries}", codes.join(", "));
      const button = fixed.querySelector<HTMLButtonElement>("[data-freeze-countries]");
      if (button) { button.disabled = state.analysisBusy || fixed.hidden; button.textContent = t("freezeCountries"); button.dataset.tooltip = `${copy?.textContent}\n\n${t("freezeCountriesHint")}`; }
    }
    const note = document.getElementById("country-minimum-reset-note");
    if (note) {
      const offer = state.countryMinimumOffer;
      note.hidden = !offer || state.analysisBusy;
      const copy = note.querySelector<HTMLElement>("[data-minimum-offer-copy]");
      if (copy) {
        const scope = state.committedQuery?.provenance?.sampleScope ?? state.index?.sampleScope;
        const prefix = scope === "ancient" ? `${t("researchAncientScope")} ` : "";
        copy.textContent = offer ? prefix + t(offer.countries.length === 1 ? "countryMinimumOffer" : "countriesMinimumOffer")
          .replace("{country}", offer.countries[0] ?? "").replace("{minimum}", String(offer.minimum)) : "";
      }
      const button = note.querySelector<HTMLButtonElement>("[data-accept-country-minimum]");
      if (button) { button.textContent = t("countryMinimumAccept"); button.disabled = note.hidden; }
    }
  }

  function setEmpty(message: string): void {
    setEmptyMessage(message);
    if (state.emptyErrorMessage) {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "small-button retry-analysis";
      retry.dataset.retryAnalysis = "";
      retry.textContent = t("retryAnalysis");
      byId("empty-state").append(retry);
    }
  }

  return {
    renderLiveStatus,
    setEmpty,
    setLoading,
  };
}
