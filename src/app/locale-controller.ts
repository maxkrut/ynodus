import { renderProvenanceNotes, renderProvenanceStrip } from "./source-card";
import type { TextKey } from "./i18n";
import type { AppState } from "./state";
import { runtimeErrorSummary } from "./runtime-errors";

type LocaleControllerOptions = {
  state: AppState;
  localeSwitcher: HTMLSelectElement;
  exportButton: HTMLButtonElement;
  provenanceStrip: HTMLElement;
  provenanceNotes?: HTMLElement;
  t: (key: TextKey) => string;
  setLoading: (loading: boolean) => void;
  setEmpty: (message: string) => void;
  renderLoadError: () => void;
  renderPresenceMode: () => void;
  renderSliceMode: () => void;
  renderTarget: () => void;
  renderLiveStatus: () => void;
  renderCountries: () => void;
  renderStats: () => void;
  renderResults: () => void;
  renderPendingResults: () => void;
  renderResearchView: () => void;
};

export function createLocaleController(options: LocaleControllerOptions) {
  function applyLocale(): void {
    const {
      state,
      localeSwitcher,
      exportButton,
      provenanceStrip,
      t,
      setLoading,
      setEmpty,
      renderLoadError,
      renderPresenceMode,
      renderSliceMode,
      renderTarget,
      renderLiveStatus,
      renderCountries,
      renderStats,
      renderResults,
      renderPendingResults,
      renderResearchView,
    } = options;

    document.documentElement.lang = state.locale;
    localeSwitcher.value = state.locale;
    exportButton.title = t("downloadCsv");
    exportButton.setAttribute("aria-label", t("downloadCsv"));
    document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
      const key = el.dataset.i18n as TextKey | undefined;
      if (key) el.textContent = t(key);
    });
    document.querySelectorAll<HTMLElement>("[data-i18n-aria-label]").forEach((el) => {
      const key = el.dataset.i18nAriaLabel as TextKey | undefined;
      if (key) el.setAttribute("aria-label", t(key));
    });
    document.querySelectorAll<HTMLButtonElement>("[data-i18n-step-label]").forEach((el) => {
      const key = el.dataset.i18nStepLabel as TextKey | undefined;
      const amount = Number(el.dataset.deltaStep ?? 0);
      if (!key || amount === 0) return;
      el.setAttribute("aria-label", `${t(key)} ${amount > 0 ? "+" : "−"}${Math.abs(amount)}`);
    });
    document.querySelectorAll<HTMLInputElement>("[data-i18n-placeholder]").forEach((el) => {
      const key = el.dataset.i18nPlaceholder as TextKey | undefined;
      if (key) el.placeholder = t(key);
    });
    document.querySelectorAll<HTMLElement>("[data-i18n-tooltip]").forEach((el) => {
      const key = el.dataset.i18nTooltip as TextKey | undefined;
      if (!key) return;
      const message = t(key);
      el.dataset.tooltip = message;
      el.title = message;
    });

    setLoading(state.loading);
    provenanceStrip.innerHTML = renderProvenanceStrip(state.index, {
      t,
      locale: state.locale,
      loadFailed: Boolean(state.loadErrorDetail),
    });
    if (options.provenanceNotes) options.provenanceNotes.innerHTML = renderProvenanceNotes(state.index, { t, locale: state.locale });
    if (!state.index && state.loadErrorDetail) {
      renderLoadError();
    } else if (!state.index) {
      setEmpty(t(state.loading ? "loading" : state.emptyMessageKey ?? "emptyLoad"));
    } else if (state.emptyErrorMessage) {
      setEmpty(runtimeErrorSummary(state.emptyErrorMessage, t, "analysis"));
    } else if (
      state.emptyMessageKey &&
      !state.analysisBusy &&
      state.analysisCohortSampleCount === null
    ) {
      setEmpty(t(state.emptyMessageKey));
    }

    renderPresenceMode();
    renderSliceMode();
    renderTarget();
    renderLiveStatus();
    renderCountries();
    renderStats();
    renderResearchView();
    if (state.analysisBusy) {
      renderPendingResults();
      return;
    }
    if (state.analysisCohortSampleCount !== null) {
      renderResults();
    }
  }

  return {
    applyLocale,
  };
}
