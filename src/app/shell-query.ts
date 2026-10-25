import { DEFAULT_TARGET_YEAR, DEFAULT_TARGET_ERA, DEFAULT_MAX_DELTA_YBP, DEFAULT_MIN_RESULT_SAMPLES, MAX_QUERY_YBP } from "./constants";
import type { TextKey } from "./i18n";
import { renderAnnotation } from "./annotation-markup";

export function renderQueryPanel(t: (key: TextKey) => string): string {
  const countries = `<div class="query-scope-row query-panel-block">
      <div class="annotated-label query-inline-label"><span id="query-evidence-label" data-i18n="queryEvidenceLabel">${t("queryEvidenceLabel")}</span>${renderAnnotation("countries", t)}</div>
      <button id="selection-panel-toggle" class="scope-picker" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="selection-panel" aria-labelledby="query-evidence-label query-chip-countries" aria-describedby="selected-country-accessible-summary country-condition-summary">
        <span class="scope-picker-copy"><strong id="query-chip-countries">${t("queryCountriesEmpty")}</strong></span>
        <span id="selected-country-flags" class="scope-flags" aria-hidden="true"></span><span aria-hidden="true">▾</span>
        <span id="selected-country-scope" class="visually-hidden">${t("selectedCountries")}</span><span id="stat-selected" class="visually-hidden">0</span><span id="stat-selected-label" class="visually-hidden">${t("countriesPlural")}</span><span id="selected-country-more" hidden></span><span id="selected-country-accessible-summary" class="visually-hidden"></span>
      </button>
      <small id="country-condition-summary" class="query-control-hint" hidden></small>
    </div>`;
  const samples = `<div class="query-inline-field sample-scope-control query-panel-block">
      <div class="annotated-label"><label for="sample-scope" data-i18n="sampleScopeLabel">${t("sampleScopeLabel")}</label>${renderAnnotation("sample-scope", t)}</div>
      <select id="sample-scope"><option value="all" data-i18n="samplesAll">${t("samplesAll")}</option><option value="modern" data-i18n="samplesModern">${t("samplesModern")}</option><option value="ancient" data-i18n="samplesAncientOnly">${t("samplesAncientOnly")}</option></select>
    </div>`;
  const time = `<div class="query-time-group query-panel-block">
      <div class="query-inline-field query-target-field" id="query-target-control">
        <div class="annotated-label"><label for="target-year" data-i18n="target">${t("target")}</label>${renderAnnotation("date", t)}</div>
        <div class="query-inline-value mockup-target-date-control">
          <input id="target-year" type="number" required value="${DEFAULT_TARGET_YEAR}" min="1" max="${MAX_QUERY_YBP}" step="1" inputmode="numeric" aria-label="${t("year")}" data-i18n-aria-label="year" data-i18n-tooltip="tooltipTargetYear" />
          <button id="target-era" class="query-value-switch" type="button" role="switch" value="${DEFAULT_TARGET_ERA}" aria-checked="${DEFAULT_TARGET_ERA === "CE"}" aria-labelledby="target-era-label target-era-current" data-i18n-tooltip="tooltipTargetEra">
            <span id="target-era-label" class="visually-hidden" data-i18n="era">${t("era")}</span><span class="query-switch-option" data-era="BCE" data-i18n="eraBceShort">${t("eraBceShort")}</span><span class="query-switch-option" data-era="CE" data-i18n="eraCeShort">${t("eraCeShort")}</span><span id="target-era-current" class="visually-hidden">${t("eraBceShort")}</span>
          </button>
        </div>
      </div>
      <div class="query-inline-field query-delta-field" id="query-delta-control">
        <div class="annotated-label"><label id="max-delta-label" for="max-delta-ybp" data-i18n="windowFromDate">${t("windowFromDate")}</label>${renderAnnotation("window", t)}</div>
        <span class="delta-stepper"><button type="button" data-delta-step="-50" data-i18n-aria-label="deltaDecrease" aria-label="${t("deltaDecrease")}" data-i18n-tooltip="deltaDecrease">−</button><span class="delta-value"><span aria-hidden="true">±</span><input id="max-delta-ybp" type="number" required min="0" max="${MAX_QUERY_YBP}" step="1" value="${DEFAULT_MAX_DELTA_YBP}" aria-labelledby="max-delta-label" /></span><button type="button" data-delta-step="50" data-i18n-aria-label="deltaIncrease" aria-label="${t("deltaIncrease")}" data-i18n-tooltip="deltaIncrease">+</button></span>
      </div>
      </div>`;
  const presence = `<div id="query-presence-control" class="query-inline-field query-switch-field query-panel-block" hidden>
        <div class="annotated-label query-inline-label"><span id="presence-label" data-i18n="presence">${t("presence")}</span>${renderAnnotation("presence", t)}</div>
        <button id="presence-mode-toggle" class="query-value-switch query-presence-switch" type="button" role="switch" value="any" aria-checked="false" aria-labelledby="presence-label presence-switch-label" aria-describedby="mode-hint">
          <span data-presence="all" data-i18n="presenceEveryCountryLabel">${t("presenceEveryCountryLabel")}</span><span data-presence="any" data-i18n="presenceAnyLabel">${t("presenceAnyLabel")}</span><span id="presence-switch-label" class="visually-hidden">${t("presenceAnyLabel")}</span><span id="presence-current" class="visually-hidden" data-i18n="anyCountry">${t("anyCountry")}</span>
        </button><small id="mode-hint" class="query-control-hint">${t("modeAnyHint")}</small>
      </div>`;
  const minimum = `<div class="query-inline-field query-min-field query-panel-block" id="query-min-control">
        <div class="annotated-label"><label id="min-result-samples-label" for="min-result-samples" data-i18n="minResultSamples">${t("minResultSamples")}</label>${renderAnnotation("minimum", t)}</div><input id="min-result-samples" type="number" min="0" step="1" value="${DEFAULT_MIN_RESULT_SAMPLES}" inputmode="numeric" aria-labelledby="min-result-samples-label" aria-describedby="min-result-samples-description" data-i18n-tooltip="tooltipMinResultSamples" />
        <small id="min-result-samples-description" data-i18n="minResultSamplesDescription">${t("minResultSamplesDescription")}</small>
      </div>`;
  const crossing = `<div id="query-crossing-control" class="query-inline-field query-binary-field query-panel-block">
        <div class="annotated-label"><label id="include-crossing-label" for="include-crossing" class="query-inline-label" data-i18n="includeCrossingShort">${t("includeCrossingShort")}</label>${renderAnnotation("crossing", t)}</div>
        <label class="query-binary-switch setting-switch"><input id="include-crossing" class="query-crossing-checkbox" type="checkbox" role="switch" aria-labelledby="include-crossing-label crossing-pair-label" aria-describedby="include-crossing-description" /><span class="setting-switch-copy"><span id="crossing-pair-label" data-i18n="crossingPairLabel">${t("crossingPairLabel")}</span>${renderSwitchState(t)}</span></label>
        <small id="include-crossing-description" class="query-control-hint" data-i18n="crossingControlHint">${t("crossingControlHint")}</small>
      </div>`;
  const density = `<div class="density-settings" role="group" aria-label="${t("densityMap")}" data-i18n-aria-label="densityMap">
      <div class="query-chart-step query-panel-block">
        <div class="density-step-control"><div class="annotated-label"><label for="density-step" data-i18n="densityStepLabel">${t("densityStepLabel")}</label>${renderAnnotation("density-step", t)}</div><span class="density-step-value"><input id="density-step" type="number" min="1" max="1000000" step="1" value="300" inputmode="numeric" aria-describedby="density-settings-status" /><span data-i18n="densityStepUnit">${t("densityStepUnit")}</span></span></div>
        <div class="density-sync-control"><label class="density-sync-label setting-switch"><input id="density-sync" type="checkbox" role="switch" /><span class="setting-switch-copy"><span data-i18n="densitySyncLabel">${t("densitySyncLabel")}</span>${renderSwitchState(t)}</span></label>${renderAnnotation("density-sync", t)}</div>
      </div>
      <div class="query-chart-grid query-panel-block">
        <div class="density-step-control"><div class="annotated-label"><label for="density-anchor" data-i18n="densityAnchorLabel">${t("densityAnchorLabel")}</label>${renderAnnotation("density-anchor", t)}</div><select id="density-anchor"><option value="axis" data-i18n="densityAnchorAxis">${t("densityAnchorAxis")}</option><option value="target" data-i18n="densityAnchorTarget">${t("densityAnchorTarget")}</option></select></div>
      </div>
      </div>`;
  return `<section class="query-zone query-bar" aria-labelledby="query-zone-title">
    <h2 id="query-zone-title" class="visually-hidden" tabindex="-1" data-i18n="timeQuestion">${t("timeQuestion")}</h2>
    <div class="query-parameters" aria-label="${t("timeMatchQuery")}" data-i18n-aria-label="timeMatchQuery">
${countries}${samples}${time}${density}${minimum}${presence}${crossing}
</div>
<div id="country-minimum-reset-note" class="query-adjustment-note" role="status" aria-atomic="true" hidden><p data-minimum-offer-copy></p><button type="button" class="small-button" data-accept-country-minimum data-i18n="countryMinimumAccept">${t("countryMinimumAccept")}</button></div>
    <button id="query-results-jump" class="query-results-jump" type="button" disabled aria-controls="results"><span id="query-result-summary" hidden><strong id="query-result-count"></strong><small id="query-result-date"></small></span><span class="query-results-jump-action"><span data-i18n="goToTimeResults">${t("goToTimeResults")}</span><span aria-hidden="true">↓</span></span></button>
  </section>`;
}

function renderSwitchState(t: (key: TextKey) => string): string {
  return `<span class="setting-switch-state" aria-hidden="true"><span class="setting-switch-off" data-i18n="settingDisabled">${t("settingDisabled")}</span><span class="setting-switch-on" data-i18n="settingEnabled">${t("settingEnabled")}</span></span>`;
}
