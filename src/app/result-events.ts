import { TABLE_ROW_INCREMENT } from "./constants";
import type { AppEventBindings } from "./event-bindings";
import { isTableSortKey } from "../results/sorting";
import type { Locale } from "../shared/types";
import { countryFlag } from "./countries";
import { renderCountryPill } from "../results/country-pills";
import { bindResultCountries } from "./result-countries";

export function bindResultEvents(bindings: AppEventBindings): void {
  bindResultCountries(bindings);
  const { state, elements, setTableSort, renderResultTable } = bindings;
  elements.emptyState.addEventListener("click", (event) => {
    const retry = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-retry-analysis]");
    if (!retry) return;
    retry.disabled = true;
    bindings.queueAnalysis();
  });

  elements.resultMacroGroupFilter.addEventListener("change", () => {
    state.resultMacroGroup = elements.resultMacroGroupFilter.value || null;
    state.tableRowLimit = TABLE_ROW_INCREMENT;
    bindings.renderResults();
  });

  elements.crossingMacroGroupFilter.addEventListener("change", () => {
    state.crossingMacroGroup = elements.crossingMacroGroupFilter.value || null;
    state.crossingTableRowLimit = TABLE_ROW_INCREMENT;
    bindings.renderResults();
  });

  elements.resultsRoot.addEventListener("click", (event) => {
    const profileButton = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-open-result-detail]",
    );
    if (profileButton?.dataset.openResultDetail) {
      const mode = profileButton.closest("table")?.dataset.resultMode === "crossing" ? "crossing" : "formed";
      void bindings.loadResultDetail(profileButton.dataset.openResultDetail, mode, profileButton.dataset.resultChild);
      return;
    }

    const suggestionButton = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-suggest-ybp]",
    );
    if (suggestionButton) {
      const ybp = Number(suggestionButton.dataset.suggestYbp);
      if (!Number.isFinite(ybp)) return;
      bindings.setTargetFromYbp(ybp);
      bindings.queueAnalysis();
      return;
    }

    const sortButton = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-table-sort]",
    );
    if (sortButton) {
      const key = sortButton.dataset.tableSort;
      if (!isTableSortKey(key)) return;
      const mode = sortButton.closest<HTMLTableElement>("table")?.dataset.resultMode;
      setTableSort(key, mode === "crossing" ? "crossing" : "formed");
      return;
    }

    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-show-more-results]",
    );
    if (!button) return;

    const mode = button.closest<HTMLTableElement>("table")?.dataset.resultMode === "crossing"
      ? "crossing"
      : "formed";
    if (mode === "crossing") state.crossingTableRowLimit += TABLE_ROW_INCREMENT;
    else state.tableRowLimit += TABLE_ROW_INCREMENT;
    renderResultTable(true, mode);
  });

  // Keep the collapsed table light: only compact text tuples are present
  // until the native <details> is opened for the first time.
  elements.resultsRoot.addEventListener("toggle", (event) => {
    const details = (event.target as HTMLElement).closest<HTMLDetailsElement>(
      "details[data-lazy-country-pills]",
    );
    if (!details?.open) return;
    materializeCountryPills(details);
  }, true);

}

export function materializeCountryPills(
  details: HTMLDetailsElement,
  renderFlag: (code: string) => string = defaultCountryFlag,
): void {
  const payload = details.dataset.lazyCountryPills;
  if (payload === undefined) return;
  const popover = details.querySelector<HTMLElement>("[data-country-pill-popover]");
  if (!popover) return;

  let entries: unknown;
  try {
    entries = JSON.parse(payload);
  } catch {
    delete details.dataset.lazyCountryPills;
    return;
  }
  if (!Array.isArray(entries)) {
    delete details.dataset.lazyCountryPills;
    return;
  }

  popover.innerHTML = entries
    .filter(
      (entry): entry is [string, string, string?] =>
        Array.isArray(entry)
        && (entry.length === 2 || entry.length === 3)
        && entry.every((value) => typeof value === "string"),
    )
    .map(([code, count, status]) => renderCountryPill(code, count, renderFlag, status))
    .join("");
  delete details.dataset.lazyCountryPills;
  details.dataset.countryPillsMaterialized = "true";
}

function defaultCountryFlag(code: string): string {
  const documentLocale = typeof document === "undefined" ? "ru" : document.documentElement.lang;
  const locale: Locale = documentLocale === "en" ? "en" : "ru";
  return countryFlag(code, locale);
}
