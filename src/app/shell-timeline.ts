import { calendarYearToYbp, DEFAULT_FULL_RANGE_MAX_YBP, YBP_BASE_YEAR, ybpToCalendarYear } from "../shared/time";
import { DEFAULT_TARGET_YEAR, DEFAULT_TARGET_ERA, DEFAULT_SLIDER_MAX_YBP, LOG_RANGE_START_BCE } from "./constants";
import type { TextKey } from "./i18n";
import { renderPeriodBandsMarkup, renderPeriodGuide } from "./timeline-periods";
import { renderAnnotation } from "./annotation-markup";

export function renderTimeline(t: (key: TextKey) => string): string {
  const defaultTargetYbp = calendarYearToYbp(DEFAULT_TARGET_ERA === "BCE" ? -DEFAULT_TARGET_YEAR : DEFAULT_TARGET_YEAR);
  const defaultTargetEra = t(DEFAULT_TARGET_ERA === "BCE" ? "eraBceShort" : "eraCeShort");
  const defaultOldestBce = Math.abs(ybpToCalendarYear(DEFAULT_FULL_RANGE_MAX_YBP));
  return `
      <section class="timeline-zone app-zone" aria-labelledby="timeline-zone-title">
        <header class="zone-heading zone-heading-inline">
          <div class="annotated-heading"><h2 id="timeline-zone-title" data-i18n="densityMap">${t("densityMap")}</h2>${renderAnnotation("density", t)}</div>
          <div class="timeline-density-legend">
            <span class="density-unit-control"><label for="density-unit" data-i18n="densityUnit">${t("densityUnit")}</label><select id="density-unit" data-density-unit><option value="subclades" data-i18n="densityUnitSubclades">${t("densityUnitSubclades")}</option><option value="parents" data-i18n="densityUnitParents">${t("densityUnitParents")}</option></select>${renderAnnotation("density-unit", t)}</span>
            <span class="density-measure-control"><span class="density-measure-switch" role="group" aria-label="${t("densityMeasureLabel")}" data-i18n-aria-label="densityMeasureLabel"><button type="button" data-density-measure="count" aria-pressed="true" data-i18n="densityMeasureCount">${t("densityMeasureCount")}</button><button type="button" data-density-measure="per1000" aria-pressed="false" data-i18n="densityMeasureRate">${t("densityMeasureRate")}</button></span>${renderAnnotation("density-measure", t)}</span>
            <span class="density-legend-context"><i aria-hidden="true"></i><span class="legend-full" data-i18n="densityContextLegend">${t("densityContextLegend")}</span><span class="legend-compact" data-i18n="densityGroupsCompact">${t("densityGroupsCompact")}</span>${renderAnnotation("density-groups", t)}</span>
            <span class="density-legend-current"><i aria-hidden="true"></i><span class="legend-full" data-i18n="densityResultLegend">${t("densityResultLegend")}</span><span class="legend-compact" data-i18n="densityResultsCompact">${t("densityResultsCompact")}</span>${renderAnnotation("density-results", t)}</span>

          </div>
          <span id="target-ybp" class="visually-hidden">${t("targetYbp")}: ${defaultTargetYbp} ${t("ybp")}</span>
        </header>
        <p id="density-settings-status" class="density-settings-status" role="status" hidden></p>
        <p id="target-outside-scale" class="density-settings-status" role="status" hidden></p>
      <section class="time-axis-panel" aria-label="${t("sliceSlider")}" data-i18n-aria-label="sliceSlider">
        <div class="slice-axis-row">
          <div class="time-axis">
            <span class="time-axis-track"></span>
            <span class="time-axis-log-track" aria-hidden="true"></span>
            <span class="time-axis-hit-window"></span>
            <span class="time-axis-zero"></span>
            <span class="time-axis-log-boundary" aria-hidden="true"></span>
            <span class="time-axis-target"></span>
            <input id="target-slider" class="time-axis-input" type="range" min="0" max="${DEFAULT_SLIDER_MAX_YBP}" step="50" value="${Math.max(0, DEFAULT_SLIDER_MAX_YBP - defaultTargetYbp)}" aria-label="${t("sliceSlider")}" data-i18n-aria-label="sliceSlider" />
            <div class="time-axis-labels">
              <span class="axis-ce"><span>${YBP_BASE_YEAR}</span> <span data-i18n="eraCeShort">${t("eraCeShort")}</span></span>
              <span id="stat-target" class="axis-target">${DEFAULT_TARGET_YEAR} ${defaultTargetEra}</span>
              <span class="axis-zero" data-i18n="calendarEraBoundary">${t("calendarEraBoundary")}</span>
              <span id="axis-bce-mid" class="axis-bce-mid">${LOG_RANGE_START_BCE} BCE</span>
              <span id="axis-bce-end" class="axis-bce-end">${defaultOldestBce} BCE</span>
            </div>
            <div class="time-axis-scale-note">
              <span id="axis-log-start" aria-hidden="true">${defaultOldestBce} BCE</span>
              <button class="scale-note-caption" type="button" data-annotation="log-scale" aria-expanded="false" aria-controls="context-annotation" aria-label="${t("compressedDates")}" data-i18n-aria-label="compressedDates">log</button>
              <span id="axis-log-end" aria-hidden="true">${LOG_RANGE_START_BCE} BCE</span>
            </div>
            <div id="target-density" class="time-axis-density" aria-label="${t("densityMap")}" data-i18n-aria-label="densityMap"></div>
            <div class="time-axis-periods" aria-hidden="true">
              ${renderPeriodBandsMarkup(t)}
            </div>
            <div class="timeline-reading-footer"><span class="annotated-label"><span class="density-height-caption" data-i18n="densityHeightShort">${t("densityHeightShort")}</span>${renderAnnotation("density-counts", t)}</span><span data-i18n="densityClickHint">${t("densityClickHint")}</span><span id="country-fixed-scope-note" class="country-fixed-scope" hidden><span class="visually-hidden" data-fixed-scope-copy></span><button type="button" class="small-button" data-freeze-countries data-i18n="freezeCountries">${t("freezeCountries")}</button>${renderAnnotation("freeze-countries",t)}</span>${renderPeriodGuide(t)}</div>
            <div id="target-density-summary" class="time-axis-density-summary" data-i18n="densityAwaitingResults">${t("densityAwaitingResults")}</div>
          </div>
        </div>
      </section>
      </section>

  `;
}
