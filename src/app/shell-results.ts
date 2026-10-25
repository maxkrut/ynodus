import type { TextKey } from "./i18n";
import { downloadIconSvg } from "./icons";
import { renderAnnotation } from "./annotation-markup";

export function renderResultsWorkspace(t: (key: TextKey) => string): string {
  return `
      <section class="results-zone app-zone" aria-labelledby="results-zone-title">
        <header class="zone-heading zone-heading-inline">
          <h2 id="results-zone-title" data-i18n="results">${t("results")}</h2>
        </header>
      <div id="empty-state" class="empty-state" role="status" aria-live="polite" aria-atomic="true"><div class="empty-title">${t("emptyLoad")}</div></div>

      <div id="results" class="results" hidden>
          <strong id="live-status" class="visually-hidden" role="status" aria-live="polite" aria-atomic="true" data-busy="false" data-i18n="liveStatus">${t("liveStatus")}</strong>
        <section class="result-set-section formed-result-set" aria-labelledby="result-title">
        <div class="mockup-table-toolbar">
          <div class="mockup-table-title">
            <div class="annotated-heading"><strong id="result-title" tabindex="-1" data-i18n="resultSet">${t("resultSet")}</strong>${renderAnnotation("formed", t)}</div><span id="result-count">0</span><span id="result-query" class="result-query"></span><em id="result-range" tabindex="-1">${t("showingZeroResults")}</em>
          </div>
          <div class="mockup-table-actions">
            <label id="result-macrogroup-control" class="result-macro-filter" hidden>
              <span data-i18n="macroGroupFilter">${t("macroGroupFilter")}</span>
              <select id="result-macrogroup-filter" aria-label="${t("formedMacroGroupFilter")}" data-i18n-aria-label="formedMacroGroupFilter" data-tooltip="${t("macroGroupFilterHint")}" data-i18n-tooltip="macroGroupFilterHint">
                <option value="" data-i18n="allMacroGroups">${t("allMacroGroups")}</option>
              </select>
            </label>
            <button id="export-csv" type="button" disabled data-tooltip="${t("tooltipExportCsv")}" data-i18n-tooltip="tooltipExportCsv" title="${t("downloadCsv")}" aria-label="${t("downloadCsv")}">${downloadIconSvg()} <span data-i18n="downloadCsv">${t("downloadCsv")}</span></button>
          </div>
        </div>
        <p class="result-reading-line" data-i18n="analysisScopeNote">${t("analysisScopeNote")}</p>
        <div class="table-wrap">
          <table aria-label="${t("formedResults")}" data-i18n-aria-label="formedResults" data-result-mode="formed">
            <thead><tr id="result-head">
              <th>#</th>
              <th data-i18n="tableBranch">${t("tableBranch")}</th>
              <th data-i18n="tableFormedSpan">${t("tableFormedSpan")}</th>
              <th data-i18n="tableDeltaRange">${t("tableDeltaRange")}</th>
              <th data-i18n="tableCountries">${t("tableCountries")}</th>
              <th data-i18n="tableSupport">${t("tableSupport")}</th>
            </tr></thead>
            <tbody id="result-body"></tbody>
          </table>
        </div>
        </section>

        <section id="crossing-results-section" class="result-set-section crossing-result-set" aria-labelledby="crossing-result-title" hidden>
          <div class="mockup-table-toolbar">
            <div class="mockup-table-title">
              <div class="annotated-heading"><strong id="crossing-result-title" data-i18n="crossingResults">${t("crossingResults")}</strong>${renderAnnotation("crossing", t)}</div><span id="crossing-result-count">0</span><em id="crossing-result-range" tabindex="-1">${t("showingZeroCrossingResults")}</em>
            </div>
            <div class="mockup-table-actions">
              <label id="crossing-macrogroup-control" class="result-macro-filter" hidden>
                <span data-i18n="macroGroupFilter">${t("macroGroupFilter")}</span>
                <select id="crossing-macrogroup-filter" aria-label="${t("crossingMacroGroupFilter")}" data-i18n-aria-label="crossingMacroGroupFilter" data-tooltip="${t("macroGroupFilterHint")}" data-i18n-tooltip="macroGroupFilterHint">
                  <option value="" data-i18n="allMacroGroups">${t("allMacroGroups")}</option>
                </select>
              </label>
            </div>
          </div>
          <p class="result-reading-line" data-i18n="crossingSummary">${t("crossingSummary")}</p>
          <div class="table-wrap">
            <table aria-label="${t("crossingResults")}" data-i18n-aria-label="crossingResults" data-result-mode="crossing">
              <thead><tr id="crossing-result-head"></tr></thead>
              <tbody id="crossing-result-body"></tbody>
            </table>
          </div>
        </section>
      </div>
      </section>
  `;
}
