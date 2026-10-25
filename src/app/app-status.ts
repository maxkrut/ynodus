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
    const note = document.getElementById("country-minimum-reset-note");
    if (note) {
      const offer = state.countryMinimumOffer;
      note.hidden = !offer || state.analysisBusy;
      const copy = note.querySelector<HTMLElement>("[data-minimum-offer-copy]");
      if (copy) copy.textContent = offer ? t(offer.countries.length === 1 ? "countryMinimumOffer" : "countriesMinimumOffer")
        .replace("{country}", offer.countries[0] ?? "").replace("{minimum}", String(offer.minimum)) : "";
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
