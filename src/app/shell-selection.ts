import type { TextKey } from "./i18n";

export function renderSelectionDialogs(t: (key: TextKey) => string): string {
  return `
    <dialog id="selection-panel" class="mockup-inline-selection-panel country-picker-dialog" aria-labelledby="selection-panel-title">
      <header>
        <div>
          <span class="dialog-kicker" data-i18n="countries">${t("countries")}</span>
          <strong id="selection-panel-title" data-i18n="countryPickerTitle">${t("countryPickerTitle")}</strong>
        </div>
        <button id="selection-panel-close" type="button" aria-label="${t("closeCountryPicker")}" data-i18n-aria-label="closeCountryPicker">×</button>
      </header>
      <div class="mockup-inline-selection-content">
        <div id="countries-panel" class="mockup-selection-pane">
          <aside class="picker-method-note">
            <strong data-i18n="evidenceMethodTitle">${t("evidenceMethodTitle")}</strong>
            <span data-i18n="countryEvidenceMethod">${t("countryEvidenceMethod")}</span>
          </aside>
          <div id="country-presets" class="preset-panel"></div>
          <label class="country-search-label" for="country-search">
            <span data-i18n="filterCountries">${t("filterCountries")}</span>
            <input id="country-search" class="search-input" type="search" aria-label="${t("filterCountries")}" data-i18n-aria-label="filterCountries" placeholder="${t("filterCountries")}" data-i18n-placeholder="filterCountries" />
          </label>
          <div id="selected-summary" class="selected-summary"></div>
          <div id="country-list" class="country-list"></div>
        </div>
      </div>
      <footer class="picker-dialog-footer">
        <span id="picker-selected-count" role="status" aria-live="polite"></span>
        <button id="selection-panel-done" class="small-button" type="button" data-i18n="done">${t("done")}</button>
      </footer>
    </dialog>

  `;
}
