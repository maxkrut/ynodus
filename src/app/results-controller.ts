import {
  renderRows,
  renderNoHitTableBody,
  renderTimeTableHead,
  type ResultTableRenderContext,
} from "../results/table-renderer";
import type { ResultRow, SliceMode } from "../shared/types";
import type { AppState } from "./state";
import { setText } from "./dom";
import type { TextKey } from "./i18n";
import { availableResultMacroGroups, filterRowsByMacroGroup } from "./result-filter";
import { MOBILE_RESULT_COUNTRY_CHIP_LIMIT, RESULT_COUNTRY_CHIP_LIMIT, TABLE_INITIAL_ROW_LIMIT } from "./constants";

type ResultsControllerOptions = {
  state: AppState;
  exportButton: HTMLButtonElement;
  resultsRoot: HTMLDivElement;
  emptyState: HTMLDivElement;
  resultHead: HTMLTableRowElement;
  resultBody: HTMLTableSectionElement;
  resultMacroGroupControl: HTMLLabelElement;
  resultMacroGroupFilter: HTMLSelectElement;
  crossingMacroGroupControl: HTMLLabelElement;
  crossingMacroGroupFilter: HTMLSelectElement;
  crossingResultsSection: HTMLElement;
  crossingResultHead: HTMLTableRowElement;
  crossingResultBody: HTMLTableSectionElement;
  targetYbp: () => number;
  t: (key: TextKey) => string;
  formatNumber: (value: number) => string;
  formatCalendar: (ybp: number) => string;
  countryFlag: (code: string) => string;
  subcladeUrl: (id: string) => string;
  moreItemsLabel: (count: number) => string;
};

export function createResultsController(options: ResultsControllerOptions) {
  const {
    state,
    exportButton,
    resultsRoot,
    emptyState,
    resultHead,
    resultBody,
    resultMacroGroupControl,
    resultMacroGroupFilter,
    crossingMacroGroupControl,
    crossingMacroGroupFilter,
    crossingResultsSection,
    crossingResultHead,
    crossingResultBody,
    targetYbp,
    t,
    formatNumber,
    formatCalendar,
  } = options;

  let countryChipLimit = typeof window !== "undefined" && window.innerWidth <= 760
    ? MOBILE_RESULT_COUNTRY_CHIP_LIMIT
    : RESULT_COUNTRY_CHIP_LIMIT;
  function measureCountryCapacity(): void {
    const width = resultHead.children?.[4]?.getBoundingClientRect().width ?? 0;
    if (typeof window !== "undefined" && window.innerWidth <= 760) {
      countryChipLimit = MOBILE_RESULT_COUNTRY_CHIP_LIMIT;
    } else if (width > 100) {
      countryChipLimit = Math.max(
        MOBILE_RESULT_COUNTRY_CHIP_LIMIT,
        Math.min(RESULT_COUNTRY_CHIP_LIMIT, Math.floor((width - 100) / 75)),
      );
    }
  }
  if (typeof window !== "undefined") {
    let frame = 0;
    window.addEventListener("resize", () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const previous = countryChipLimit;
        measureCountryCapacity();
        if (previous !== countryChipLimit && !state.analysisBusy && !resultsRoot.hidden
          && !resultsRoot.querySelector("dialog[open]") && !resultsRoot.contains(document.activeElement)) {
          renderResultTable();
        }
      });
    });
  }

  function tableRenderContext(sliceMode: SliceMode = "formed"): ResultTableRenderContext {
    return {
      t,
      formatNumber,
      formatCalendar,
      countryFlag: options.countryFlag,
      subcladeUrl: options.subcladeUrl,
      moreItemsLabel: options.moreItemsLabel,
      locale: state.locale,
      sliceMode,
      countryChipLimit,
      targetYbp: resultChromeQuery().targetYbp,
      sampleScope: state.committedQuery?.provenance?.sampleScope ?? state.index?.sampleScope ?? "all",
    };
  }

  function resultChromeQuery(): {
    targetYbp: number;
    maxDeltaYbp: number;
    includeCrossing: boolean;
  } {
    if (!state.analysisBusy && state.committedQuery) {
      return {
        targetYbp: state.committedQuery.targetYbp,
        maxDeltaYbp: state.committedQuery.maxDeltaYbp,
        includeCrossing: state.committedQuery.includeCrossing,
      };
    }
    return {
      targetYbp: targetYbp(),
      maxDeltaYbp: state.maxDeltaYbp,
      includeCrossing: state.includeCrossing,
    };
  }

  function renderResultChrome(): void {
    const jump = document.getElementById("query-results-jump") as HTMLButtonElement | null;
    if (jump) jump.disabled = Boolean(state.analysisBusy || !state.committedQuery);
    const query = resultChromeQuery();
    if (!state.analysisBusy) renderMacroGroupFilters();
    const formedRows = filteredRows(state.results);
    const crossingRows = filteredRows(state.crossingResults, "crossing");
    setText("result-count", resultCountLabel(formedRows.length, state.results.length));
    setText(
      "result-title",
      t("foundBranches"),
    );
    const queryLabel = `${t("target")}: ${formatCalendar(query.targetYbp)} · ±${formatNumber(query.maxDeltaYbp)} ${t("queryDeltaYears")}`;
    setText("result-query", queryLabel);
    setText("query-result-count", `${t("foundBranches")}: ${resultCountLabel(formedRows.length, state.results.length)}`);
    setText("query-result-date", queryLabel);
    const summary = document.getElementById("query-result-summary");
    if (summary) summary.hidden = state.analysisBusy || !state.committedQuery;
    setText(
      "crossing-result-count",
      resultCountLabel(crossingRows.length, state.crossingResults.length, "crossing"),
    );
    setText(
      "crossing-result-title",
      `${t("crossingResults")} (${t("target")}: ${formatCalendar(query.targetYbp)})`,
    );
    resultHead.innerHTML = renderTimeTableHead(state.tableSort, tableRenderContext("formed"));
    crossingResultHead.innerHTML = renderTimeTableHead(
      state.crossingTableSort,
      tableRenderContext("crossing"),
    );
    crossingResultsSection.hidden = !query.includeCrossing;
  }

  function renderResults(): void {
    resultsRoot.removeAttribute("aria-busy");
    renderResultChrome();
    updateRanges();
    exportButton.disabled = state.analysisBusy
      || !state.committedQuery
      || (filteredRows(state.results).length === 0
        && (!state.committedQuery?.includeCrossing || filteredRows(state.crossingResults, "crossing").length === 0));
    emptyState.hidden = true;
    resultsRoot.hidden = false;
    renderResultTable();
  }

  function renderResultTable(
    focusAfterRender = false,
    focusMode: SliceMode = "formed",
  ): void {
    renderMacroGroupFilters();
    const formedRows = filteredRows(state.results);
    const crossingRows = filteredRows(state.crossingResults, "crossing");
    resultHead.innerHTML = renderTimeTableHead(state.tableSort, tableRenderContext("formed"));
    measureCountryCapacity();
    resultBody.innerHTML = formedRows.length > 0
      ? renderRows(
          {
            rows: formedRows,
            tableRowLimit: state.tableRowLimit,
            tableSort: state.tableSort,
          },
          tableRenderContext("formed"),
        )
      : renderNoHitTableBody(
          tableRenderContext("formed"),
          state.resultMacroGroup ? "macroGroupNoRows" : formedNoResultMessageKey(),
          state.resultMacroGroup ? null : state.neighborSuggestions,
        );

    crossingResultHead.innerHTML = renderTimeTableHead(
      state.crossingTableSort,
      tableRenderContext("crossing"),
    );
    crossingResultBody.innerHTML = crossingRows.length > 0
      ? renderRows(
          {
            rows: crossingRows,
            tableRowLimit: state.crossingTableRowLimit,
            tableSort: state.crossingTableSort,
          },
          tableRenderContext("crossing"),
        )
      : renderNoHitTableBody(
          tableRenderContext("crossing"),
          state.crossingMacroGroup ? "macroGroupNoRows" : "showingZeroCrossingResults",
          null,
        );
    updateRanges();

    if (!focusAfterRender) return;
    const body = focusMode === "crossing" ? crossingResultBody : resultBody;
    const showMore = body.querySelector<HTMLButtonElement>("[data-show-more-results]");
    if (showMore) {
      showMore.focus();
      return;
    }
    const range = document.getElementById(
      focusMode === "crossing" ? "crossing-result-range" : "result-range",
    );
    if (range instanceof HTMLElement) range.focus();
    else body.closest("table")?.focus();
  }

  function updateRanges(): void {
    const formedRows = filteredRows(state.results);
    const crossingRows = filteredRows(state.crossingResults, "crossing");
    resultsRoot.classList.toggle("show-result-range", formedRows.length > state.tableRowLimit
      || state.tableRowLimit > TABLE_INITIAL_ROW_LIMIT || Boolean(state.resultMacroGroup));
    setText(
      "result-range",
      rangeLabel(formedRows.length, state.results.length, state.tableRowLimit, "formed"),
    );
    setText(
      "crossing-result-range",
      rangeLabel(
        crossingRows.length,
        state.crossingResults.length,
        state.crossingTableRowLimit,
        "crossing",
      ),
    );
  }

  function rangeLabel(filteredTotal: number, total: number, limit: number, mode: SliceMode): string {
    if (filteredTotal === 0) {
      if (macroGroupForMode(mode)) {
        return `${t("macroGroupNoRows")} · 0 ${t("of")} ${formatNumber(total)} ${t("calculatedRows")}`;
      }
      return t(mode === "crossing" ? "showingZeroCrossingResults" : "showingZeroResults");
    }
    const base = `${t("showing")} 1-${formatNumber(Math.min(filteredTotal, limit))} ${t("of")} ${formatNumber(filteredTotal)}`;
    return macroGroupForMode(mode)
      ? `${base} · ${formatNumber(total)} ${t("calculatedRows")}`
      : base;
  }

  function macroGroupForMode(mode: SliceMode): string | null {
    return mode === "crossing" ? state.crossingMacroGroup : state.resultMacroGroup;
  }

  function filteredRows(rows: readonly ResultRow[], mode: SliceMode = "formed"): ResultRow[] {
    return filterRowsByMacroGroup(rows, macroGroupForMode(mode));
  }

  function resultCountLabel(filteredTotal: number, total: number, mode: SliceMode = "formed"): string {
    if (state.analysisBusy) return "-";
    return macroGroupForMode(mode)
      ? `${formatNumber(filteredTotal)} / ${formatNumber(total)}`
      : formatNumber(total);
  }

  function renderMacroGroupFilters(): void {
    // A restored selection cannot be checked against rows that have not loaded yet.
    if (state.analysisBusy || !state.committedQuery) {
      resultMacroGroupFilter.disabled = true;
      crossingMacroGroupFilter.disabled = true;
      return;
    }
    for (const mode of ["formed", "crossing"] as const) {
      const key = mode === "crossing" ? "crossingMacroGroup" : "resultMacroGroup";
      const rows = mode === "crossing" ? state.crossingResults : state.results;
      const control = mode === "crossing" ? crossingMacroGroupControl : resultMacroGroupControl;
      const select = mode === "crossing" ? crossingMacroGroupFilter : resultMacroGroupFilter;
      const groups = availableResultMacroGroups(rows);
      if (state[key] && !groups.includes(state[key]!)) state[key] = null;
      control.hidden = groups.length < 2;
      select.disabled = state.analysisBusy || groups.length < 2;
      select.replaceChildren();
      for (const group of ["", ...groups]) {
        const option = document.createElement("option");
        option.value = group;
        option.textContent = group || t("allMacroGroups");
        select.append(option);
      }
      select.value = state[key] ?? "";
    }
  }

  function renderPendingResults(): void {
    if (resultsRoot.hidden) return;
    resultsRoot.setAttribute("aria-busy", "true");
    exportButton.setAttribute("disabled", "");
    resultMacroGroupFilter.disabled = true;
    crossingMacroGroupFilter.disabled = true;
    renderResultChrome();
    setText("result-range", t("recalculating"));
    resultBody.innerHTML = pendingTableBody();
    if (state.includeCrossing) {
      setText("crossing-result-range", t("recalculating"));
      crossingResultBody.innerHTML = pendingTableBody();
    }
  }

  function pendingTableBody(): string {
    return `<tr><td colspan="6"><div class="muted-block" data-i18n="recalculating">${t("recalculating")}</div></td></tr>`;
  }

  function formedNoResultMessageKey(): TextKey {
    if (state.presenceMode === "all") return "emptyNoAll";
    return "emptyDeltaWindow";
  }

  return {
    renderResults,
    renderResultTable,
    renderPendingResults,
    tableRenderContext,
  };
}
