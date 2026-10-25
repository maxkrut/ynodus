import type { AppEventBindings } from "./event-bindings";
import { countryFlag, countryName } from "./countries";
import { escapeHtml } from "../shared/html";
import { pluralLabel } from "../shared/plural";
import { sortedCountryEntries } from "../results/sorting";
import { restoreDialogFocus, trapDialogTab } from "./dialog-focus";

/** Lazy, presentation-only detail of a committed row; no query or route changes. */
export function bindResultCountries({ state, elements, t }: AppEventBindings): void {
  const dialog = document.createElement("dialog");
  dialog.id = "result-countries-dialog";
  dialog.className = "result-countries-dialog";
  dialog.setAttribute("aria-labelledby", "result-countries-title");
  elements.app.append(dialog);
  let opener: HTMLButtonElement | null = null;
  const close = () => { if (dialog.open) dialog.close(); };
  dialog.addEventListener("keydown", event => trapDialogTab(event, dialog));
  dialog.addEventListener("click", event => {
    if ((event.target as HTMLElement).closest("[data-close-result-countries]")) close();
    if (event.target === dialog) {
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
    }
  });
  dialog.addEventListener("close", () => {
    restoreDialogFocus(dialog, opener?.isConnected ? opener : null);
    dialog.innerHTML = "";
    opener = null;
  });
  // Closing on a result replacement also prevents stale summary text after locale/query changes.
  const observer = new MutationObserver(close);
  observer.observe(elements.resultBody, { childList: true });
  observer.observe(elements.crossingResultBody, { childList: true });
  observer.observe(elements.resultsRoot, { attributes: true, attributeFilter: ["aria-busy", "hidden"] });

  elements.resultsRoot.addEventListener("click", event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-result-countries]");
    const query = state.committedQuery;
    if (!button || state.analysisBusy || !query) return;
    const mode = button.closest("table")?.dataset.resultMode === "crossing" ? "crossing" : "formed";
    const row = (mode === "crossing" ? state.crossingResults : state.results).find(candidate =>
      candidate.node.id === button.dataset.resultCountries
      && candidate.crossingChild?.id === button.dataset.resultChild);
    if (!row) return;
    const format = (n: number) => new Intl.NumberFormat(state.locale).format(n);
    const entries = sortedCountryEntries(row.countryCounts).filter(([, count]) => count > 0);
    const common = query.presenceMode === "all";
    const required = new Set(state.countryParticipation?.[mode] ?? query.selectedCountries);
    const active = entries.filter(([code]) => !common || required.has(code));
    const below = entries.filter(([code]) => common && !required.has(code));
    const presentLabel = pluralLabel(state.locale, entries.length, t("resultCountryPresentOne"), t("resultCountryPresentFew"), t("resultCountryPresentMany"));
    const list = (countries: [string, number][]) => `<div class="result-country-grid">${countries.map(([code, count]) => `
      <div class="result-country-item"><span class="flag" aria-hidden="true">${countryFlag(code, state.locale)}</span><span class="result-country-name">${escapeHtml(countryName(code, state.locale))}<small>${escapeHtml(code)}</small></span><strong>${format(count)}</strong></div>`).join("")}</div>`;
    const identity = row.crossingChild ? `${row.node.id} → ${row.crossingChild.id}` : row.node.id;
    opener = button;
    dialog.innerHTML = `<header><h3 id="result-countries-title">${escapeHtml(identity)}: ${format(entries.length)} ${presentLabel}</h3><button type="button" data-close-result-countries aria-label="${t("resultCountriesClose")}">×</button></header>
      <div class="result-countries-content">
        <p class="result-countries-intro">${t("resultCountriesTotal")}: <strong>${format(row.total)}</strong>${common && query.minResultSamples > 0 ? ` · ${t("resultCountriesMinimum")}: <strong>${format(query.minResultSamples)}</strong>` : ""}</p>
        <section data-result-countries-group="active"><h4>${common ? t(query.minResultSamples > 0 ? "resultCountriesQualified" : "resultCountriesRequired") : t("resultCountriesPresent")} - ${format(active.length)}</h4><p>${t(common ? query.minResultSamples > 0 ? "resultCountriesRequiredHint" : "resultCountriesStrictHint" : "resultCountriesAnyHint")}</p>${list(active)}</section>
        ${below.length ? `<section data-result-countries-group="below"><h4>${t("resultCountriesBelow")} - ${format(below.length)}</h4><p>${t("resultCountriesBelowHint")}</p>${list(below)}</section>` : ""}
        <footer><p>${t("resultCountriesCountsHint")}</p><p>${t("resultCountriesAbsent")}: <strong>${format(query.selectedCountries.length - entries.length)}</strong></p></footer>
      </div>`;
    dialog.showModal();
  });
}
