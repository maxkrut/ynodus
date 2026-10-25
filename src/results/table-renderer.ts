import { groupColor } from "../shared/colors";
import { groupFillColor } from "../shared/group-palette";
import { nodeMacroGroup } from "../shared/haplogroups";
import { escapeHtml } from "../shared/html";
import { pluralLabel } from "../shared/plural";
import type {
  Locale,
  NeighborSuggestions,
  ResultRow,
  SampleScope,
  SliceMode,
  SortDirection,
  TableSortKey,
} from "../shared/types";
import {
  compareRowsByTableSort,
  sortedCountryEntries,
  tableSortForMode,
  type TableSortState,
} from "./sorting";
import type { TextKey } from "../app/i18n";
import { renderCountryPills } from "./country-pills";
import { formedBranchDetails } from "./formed-branch-model";

export type ResultTableRenderContext = {
  t: (key: TextKey) => string;
  formatNumber: (value: number) => string;
  formatCalendar: (ybp: number) => string;
  countryFlag: (code: string) => string;
  subcladeUrl: (id: string) => string;
  moreItemsLabel: (count: number) => string;
  locale: Locale;
  sliceMode: SliceMode;
  countryChipLimit?: number;
  targetYbp?: number;
  sampleScope?: SampleScope;
};

type SampleScopeQualifier = { text: string; filtered: boolean };

function sampleScopeQualifier(context: ResultTableRenderContext): SampleScopeQualifier {
  const scope = context.sampleScope ?? "all";
  const key = scope === "ancient" ? "samplesAncient" : scope === "modern" ? "samplesModern" : "samplesAll";
  return { text: context.t(key).toLocaleLowerCase(context.locale), filtered: scope !== "all" };
}

function renderScopeQualifier(qualifier?: SampleScopeQualifier): string {
  return qualifier ? ` <span class="table-sample-scope">(<span class="table-sample-scope-label${qualifier.filtered ? " is-filtered" : ""}">${escapeHtml(qualifier.text)}</span>)</span>` : "";
}

type RenderRowsOptions = {
  rows: ResultRow[];
  tableRowLimit: number;
  tableSort: TableSortState;
};

export function renderTimeTableHead(
  tableSort: TableSortState,
  context: ResultTableRenderContext,
): string {
  const effectiveSort = tableSortForMode(tableSort, context.sliceMode);
  if (context.sliceMode === "formed") {
    return `
      <th>#</th>
      ${renderSortableTableHead("subclade", context.t("tableBranch"), effectiveSort)}
      ${renderSortableTableHead("formed", context.t("tableFormedSpan"), effectiveSort, context.t("tableFormedHint"))}
      ${renderSortableTableHead("delta", context.t("tableDeltaRange"), effectiveSort, context.t("tableDeltaHint"), context.targetYbp === undefined ? undefined : context.formatCalendar(context.targetYbp))}
      <th data-i18n="tableCountries">${context.t("tableCountries")}</th>
      ${renderSortableTableHead("total", context.t("tableSupport"), effectiveSort, context.t("tableSupportHint"), undefined, sampleScopeQualifier(context))}
    `;
  }
  return `
    <th>#</th>
    ${renderSortableTableHead("subclade", context.t("tableCrossingEdge"), effectiveSort)}
    ${renderSortableTableHead("formed", context.t("tableFormed"), effectiveSort, context.t("tableCrossingFormedHint"))}
    <th>${context.t("tablePath")} (${context.t("tablePathDirection")})</th>
    <th data-i18n="tableCountries">${context.t("tableCountries")}</th>
    ${renderSortableTableHead("total", context.t("tableSupport"), effectiveSort, context.t("tableSupportHint"), undefined, sampleScopeQualifier(context))}
  `;
}

export function renderRows(
  options: RenderRowsOptions,
  context: ResultTableRenderContext,
): string {
  const { rows, tableRowLimit, tableSort } = options;
  const effectiveSort = tableSortForMode(tableSort, context.sliceMode);
  const sortedRows = [...rows].sort((a, b) => compareRowsByTableSort(a, b, effectiveSort));
  const resultRows = sortedRows;
  let maxTotal = 1;
  for (const row of resultRows) maxTotal = Math.max(maxTotal, row.total);
  const visibleRows = resultRows.slice(0, tableRowLimit);
  const htmlParts: string[] = [];
  let rowNumber = 0;
  for (const row of visibleRows) {
    rowNumber += 1;
    htmlParts.push(renderRow(row, maxTotal, context, rowNumber));
  }
  const html = htmlParts.join("");
  const hiddenRows = resultRows.length - visibleRows.length;

  if (hiddenRows <= 0) return html;

  return `
    ${html}
    <tr class="show-more-row">
      <td colspan="6">
        <button class="small-button" type="button" data-show-more-results>
          ${context.t("showMoreResults")} · ${context.formatNumber(visibleRows.length)} / ${context.formatNumber(resultRows.length)}
        </button>
      </td>
    </tr>
  `;
}

function renderTotalBar(
  total: number,
  maxTotal: number,
  formatNumber: (value: number) => string,
): string {
  const pct = Math.max(3, Math.round((total / Math.max(maxTotal, 1)) * 100));
  return `
    <div class="table-total">
      <strong class="result-primary-value">${formatNumber(total)}</strong>
      <div class="total-bar-track" aria-hidden="true">
        <div class="total-bar-fill" style="width:${pct}%"></div>
      </div>
    </div>
  `;
}

function renderSortableTableHead(
  key: TableSortKey,
  label: string,
  tableSort: TableSortState,
  hint?: string,
  referenceDate?: string,
  qualifier?: SampleScopeQualifier,
): string {
  const active = tableSort.key === key;
  return `
    <th aria-sort="${ariaSort(tableSort, key)}">
      <button class="table-sort-button${active ? " active" : ""}" type="button" data-table-sort="${key}"${hint ? ` data-tooltip="${escapeHtml(hint)}"` : ""}>
        <span>${escapeHtml(label)}${renderScopeQualifier(qualifier)}${referenceDate ? `<small class="table-reference-date">${escapeHtml(referenceDate)}</small>` : ""}</span>
        <span class="sort-indicator" aria-hidden="true">${active ? sortArrow(tableSort.direction) : "↕"}</span>
      </button>
    </th>
  `;
}

function ariaSort(tableSort: TableSortState, key: TableSortKey): string {
  if (tableSort.key !== key) return "none";
  return tableSort.direction === "asc" ? "ascending" : "descending";
}

function sortArrow(direction: SortDirection): string {
  return direction === "asc" ? "↑" : "↓";
}

export function renderNoHitTableBody(
  context: ResultTableRenderContext,
  messageKey: TextKey = "emptyDeltaWindow",
  suggestions: NeighborSuggestions | null = null,
): string {
  const suggestionButtons = suggestions
    ? ([
        ["olderLayer", suggestions.older],
        ["youngerLayer", suggestions.younger],
      ] as const)
        .filter((entry): entry is readonly ["olderLayer" | "youngerLayer", number] => entry[1] !== null)
        .map(([labelKey, ybp]) => `
          <button class="small-button" type="button" data-suggest-ybp="${ybp}">
            ${context.t(labelKey)} · ${context.formatCalendar(ybp)}
          </button>
        `)
        .join("")
    : "";
  return `
    <tr class="no-result-row">
      <td class="no-result-cell" colspan="6">
        <div class="muted-block no-result-message">
          <span>${context.t(messageKey)}</span>
          ${suggestionButtons ? `<span>${context.t("emptyNeighborIntro")}</span><span class="no-result-actions">${suggestionButtons}</span>` : ""}
        </div>
      </td>
    </tr>
  `;
}

function renderCountrySummaryAction(row: ResultRow, context: ResultTableRenderContext): string {
  return `<button class="country-info-button" type="button" data-result-countries="${escapeHtml(row.node.id)}"${row.crossingChild ? ` data-result-child="${escapeHtml(row.crossingChild.id)}"` : ""} aria-haspopup="dialog">${context.t("resultCountriesAbout")}</button>`;
}

function renderRow(
  row: ResultRow,
  maxTotal: number,
  context: ResultTableRenderContext,
  rowNumber: number,
): string {
  return row.crossingChild
    ? renderCrossingRow(row, maxTotal, context, rowNumber)
    : renderFormedRow(row, maxTotal, context, rowNumber);
}

function renderCrossingRow(
  row: ResultRow,
  maxTotal: number,
  context: ResultTableRenderContext,
  rowNumber: number,
): string {
  const entries = sortedCountryEntries(row.countryCounts);
  const child = row.crossingChild!;
  const subcladeIdentity = `<span class="crossing-pair"><span class="crossing-endpoint">${renderSubcladeReference(row.node.id, nodeMacroGroup(row.node), context)}</span><span class="crossing-endpoint"><span aria-hidden="true"> → </span>${renderSubcladeReference(child.id, nodeMacroGroup(child), context)}</span></span>`;
  const formedIdentity = `<span class="crossing-pair crossing-dates"><span class="crossing-endpoint">~${context.formatCalendar(row.node.formed)}</span><span class="crossing-endpoint"> → ~${context.formatCalendar(child.formed)}</span></span>`;
  const sourceDateInverted = Boolean(
    row.node.formed < child.formed,
  );
  const macroGroup = nodeMacroGroup(row.node);
  const macroGroupColor = groupColor(macroGroup);
  return `
    <tr
      class="${[
        "result-role-crossing",
      ].join(" ")}"
      data-result-role="crossing"
      data-macro-group="${escapeHtml(macroGroup)}"
      style="--macro-group-color:${macroGroupColor}"
    >
      <td class="mockup-row-number"><span class="result-primary-value">${context.formatNumber(rowNumber)}</span></td>
      <td class="mockup-subclade-cell">
        ${renderMobileCellLabel(context.t("tableCrossingEdge"))}
        <div class="mockup-subclade-main">
          ${renderMacroGroupLabel(macroGroup)}
          <span class="table-branch-identity">${subcladeIdentity}</span>
          ${renderResultActions(row, context)}
        </div>
      </td>
      <td>
        ${renderMobileCellLabel(context.t("tableFormed"))}
        <div class="result-primary-value">${formedIdentity}</div>
        ${sourceDateInverted ? `<span class="source-date-anomaly" title="${escapeHtml(context.t("sourceDateInversion"))}">${escapeHtml(context.t("sourceDateInversion"))}</span>` : ""}
      </td>
      <td class="mockup-path">
        ${renderMobileCellLabel(`${context.t("tablePath")} (${context.t("tablePathDirection")})`)}
        <div class="result-primary-value">${renderPath(row.path)}</div>
      </td>
      <td>
        ${renderMobileCellLabel(context.t("tableCountries"))}
        ${renderCountryPills(entries, context, row.belowMinimumCountryCounts ? sortedCountryEntries(row.belowMinimumCountryCounts) : [], renderCountrySummaryAction(row, context))}
      </td>
      <td class="mockup-support">
        ${renderMobileCellLabel(context.t("tableSupport"), sampleScopeQualifier(context))}
        ${renderTotalBar(row.total, maxTotal, context.formatNumber)}
      </td>
    </tr>
  `;
}

function renderFormedRow(
  row: ResultRow,
  maxTotal: number,
  context: ResultTableRenderContext,
  rowNumber: number,
): string {
  const entries = sortedCountryEntries(row.countryCounts);
  const { events, subcladeCount, formedSpan, deltaRange } = formedBranchDetails(row);
  const hasDetails = events.length > 1 || subcladeCount > 1;
  const macroGroup = nodeMacroGroup(row.node);
  const macroGroupColor = groupColor(macroGroup);
  return `
    <tr class="result-role-formed formed-branch-result-row" data-result-role="formed"
      data-macro-group="${escapeHtml(macroGroup)}" style="--macro-group-color:${macroGroupColor}">
      <td class="mockup-row-number"><span class="result-primary-value">${context.formatNumber(rowNumber)}</span></td>
      <td class="mockup-subclade-cell">
        ${renderMobileCellLabel(context.t("tableBranch"))}
        <div class="mockup-subclade-main">
          ${renderMacroGroupLabel(macroGroup)}
          <span class="table-branch-identity">${renderSubcladeReference(row.node.id, macroGroup, context)}</span>
          ${renderResultActions(row, context)}
        </div>
        ${hasDetails ? `<span class="formed-branch-summary-text">${escapeHtml(renderCompactBranchSummary(subcladeCount, events.length, context))}</span>` : ""}
      </td>
      <td>
        ${renderMobileCellLabel(context.t("tableFormedSpan"))}
        <div class="result-primary-value">${renderFormedSpan(formedSpan, context)}</div>
      </td>
      <td>
        ${renderMobileCellLabel(`${context.t("tableDeltaRange")}${context.targetYbp === undefined ? "" : ` · ${context.formatCalendar(context.targetYbp)}`}`)}
        <div class="result-primary-value">${renderDeltaRange(deltaRange, context)}</div>
      </td>
      <td>
        ${renderMobileCellLabel(context.t("tableCountries"))}
        ${renderCountryPills(entries, context, row.belowMinimumCountryCounts ? sortedCountryEntries(row.belowMinimumCountryCounts) : [], renderCountrySummaryAction(row, context))}
      </td>
      <td class="mockup-support">
        ${renderMobileCellLabel(context.t("tableSupport"), sampleScopeQualifier(context))}
        ${renderTotalBar(row.total, maxTotal, context.formatNumber)}
      </td>
    </tr>
  `;
}

function renderMobileCellLabel(label: string, qualifier?: SampleScopeQualifier): string {
  return `<span class="mobile-cell-label">${escapeHtml(label)}${renderScopeQualifier(qualifier)}</span>`;
}

function renderMacroGroupLabel(macroGroup: string): string {
  return `<span class="row-macro-label" aria-label="${escapeHtml(macroGroup)}"
    style="--row-color:${groupColor(macroGroup)};--row-fill:${groupFillColor(macroGroup)}"><i aria-hidden="true"></i>${escapeHtml(macroGroup)}</span>`;
}

function renderCompactBranchSummary(
  subcladeCount: number,
  formationDateCount: number,
  context: ResultTableRenderContext,
): string {
  const descendantCount = Math.max(0, subcladeCount - 1);
  const descendantLabel = pluralLabel(
    context.locale,
    descendantCount,
    context.t("descendantSubcladeCountOne"),
    context.t("descendantSubcladeCountFew"),
    context.t("descendantSubcladeCountMany"),
  );
  const dateLabel = formationDateCount === 1
    ? context.t("sameFormationEstimateSuffix")
    : `${context.formatNumber(formationDateCount)} ${pluralLabel(
        context.locale,
        formationDateCount,
        context.t("formationDateCountOne"),
        context.t("formationDateCountFew"),
        context.t("formationDateCountMany"),
      )}`;
  const separator = formationDateCount === 1 ? " " : " · ";
  return `${context.formatNumber(descendantCount)} ${descendantLabel}${separator}${dateLabel}`;
}

function renderFormedSpan(
  span: NonNullable<ResultRow["formedSpan"]>,
  context: ResultTableRenderContext,
): string {
  if (span.olderYbp === span.youngerYbp) return `~${context.formatCalendar(span.olderYbp)}`;
  return `~${context.formatCalendar(span.olderYbp)} <span aria-hidden="true">→</span> ~${context.formatCalendar(span.youngerYbp)}`;
}

function renderDeltaRange(
  range: NonNullable<ResultRow["deltaRange"]>,
  context: ResultTableRenderContext,
): string {
  const format = (value: number) => context.formatNumber(value);
  if (range.minYbp === range.maxYbp) return format(range.minYbp);
  return `${format(range.minYbp)}–${format(range.maxYbp)}`;
}

function renderPath(pathNodes: ResultRow["path"]): string {
  const lineage = pathNodes.map((node) => node.id);
  const fullPath = lineage.join("  ›  ");
  const visiblePath = `${lineage.length > 5 ? "…  ›  " : ""}${lineage.slice(-5).join("  ›  ")}`;
  return `<span title="${escapeHtml(fullPath)}" aria-label="${escapeHtml(fullPath)}">${escapeHtml(visiblePath)}</span>`;
}

function renderSubcladeReference(id: string, project: string, _context: ResultTableRenderContext): string {
  const macroGroup = project;
  const style = ` style="--row-color:${groupColor(project)}"`;
  const group = ` data-macro-group="${escapeHtml(macroGroup)}"`;
  return `<span class="subclade-link"${group}${style}>${escapeHtml(id)}</span>`;
}

function renderResultActions(row: ResultRow, context: ResultTableRenderContext): string {
  const yfull = (id: string) => {
    const url = context.subcladeUrl(id);
    return url ? `<a class="table-profile-action table-yfull-action" href="${escapeHtml(url)}" target="_blank" rel="noreferrer"
      aria-label="${escapeHtml(`YFull: ${id} · ${context.t("resultExternalWindow")}`)}">YFull${row.crossingChild ? `: ${escapeHtml(id)}` : ""} ↗</a>` : "";
  };
  return `<span class="table-result-actions"><button class="table-profile-action" type="button"
    data-open-result-detail="${escapeHtml(row.node.id)}"${row.crossingChild ? ` data-result-child="${escapeHtml(row.crossingChild.id)}"` : ""}
    aria-label="${escapeHtml(`${context.t("resultDetailsAction")}: ${row.node.id}${row.crossingChild ? ` → ${row.crossingChild.id}` : ""}`)}">${escapeHtml(context.t("resultDetailsAction"))}</button>
    ${yfull(row.node.id)}${row.crossingChild ? yfull(row.crossingChild.id) : ""}</span>`;
}
