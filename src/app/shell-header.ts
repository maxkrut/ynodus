import { APP_VERSION, DEFAULT_LOCALE } from "./constants";
import { globeIconSvg } from "./icons";
import type { TextKey } from "./i18n";
import { renderProvenanceNotes, renderProvenanceStrip } from "./source-card";

export function renderHeader(t: (key: TextKey) => string): string {
  const version = APP_VERSION.replace(/^v/, "").split(".").slice(0, 2).join(".");
  return `<header class="app-header">
    <div class="title-block">
      <div class="brand-head"><span class="brand-logo-text" role="img" aria-label="yNodus"><span class="brand-logo-initial" aria-hidden="true">y</span><span aria-hidden="true">Nodus</span></span><span class="version-pill">${version}</span></div>
      <h1 data-i18n="workbenchTagline">${t("workbenchTagline")}</h1>
    </div>
    <section class="header-provenance" aria-label="${t("provenance")}" data-i18n-aria-label="provenance">
      <div id="provenance-strip" class="provenance-strip">${renderProvenanceStrip(null, { t, locale: DEFAULT_LOCALE })}</div>
    </section>
    <div class="header-utilities">
      <label class="header-language" for="locale-switcher">${globeIconSvg()}<span class="visually-hidden" data-i18n="language">${t("language")}</span>
        <select id="locale-switcher" aria-label="${t("language")}" data-i18n-aria-label="language">
          <option value="en" lang="en">English</option><option value="ru" lang="ru" selected>Русский</option>
        </select>
      </label>
    </div>
    <div id="provenance-notes" hidden>${renderProvenanceNotes(null, { t, locale: DEFAULT_LOCALE })}</div>
  </header>
  <nav class="research-entrypoints" aria-label="${t("applicationActions")}" data-i18n-aria-label="applicationActions">
    <button type="button" data-research-view="time"><span data-i18n="exploreTime">${t("exploreTime")}</span></button>
    <button type="button" data-research-view="profile"><span data-i18n="exploreClade">${t("exploreClade")}</span></button>
    <button type="button" data-research-view="country-overview"><span data-i18n="exploreCountry">${t("exploreCountry")}</span></button>
  </nav><p id="workspace-link-note" class="workspace-link-note" role="status" hidden></p>`;
}
