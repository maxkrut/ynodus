import type { TextKey } from "./i18n";
import { readSampleScope } from "./sample-scope";

export function renderResearchWorkspaces(t: (key: TextKey) => string): string {
  const scope = readSampleScope();
  const key = scope === "ancient" ? "researchAncientScope" : "researchModernScope";
  const scopeNote = scope === "all" ? "" : `<p class="research-sample-note" data-i18n="${key}">${t(key)}</p>`;
  return `<main id="profile-workspace" class="research-workspace" data-research-panel="profile" hidden>
    <nav class="nested-page-breadcrumb" aria-label="${t("nestedNavigation")}" data-i18n-aria-label="nestedNavigation">
      <button type="button" data-research-back hidden><span aria-hidden="true">←</span> <span>${t("returnToCladeSearch")}</span></button>
      <span aria-hidden="true">/</span><strong data-i18n="subcladeProfileView">${t("subcladeProfileView")}</strong>
    </nav>
    ${scopeNote}
    <header class="research-workspace-heading">
      <div><h2 id="profile-workspace-title" tabindex="-1" data-i18n="profileQuestion">${t("profileQuestion")}</h2><p data-i18n="profileWorkspaceCopy">${t("profileWorkspaceCopy")}</p></div>
      <form id="profile-lookup" class="profile-lookup">
        <label for="profile-clade-search" data-i18n="signatureSubclade">${t("signatureSubclade")}</label>
        <div class="profile-lookup-controls"><input id="profile-clade-search" type="search" name="clade" placeholder="${t("profileSearchPlaceholder")}" data-i18n-placeholder="profileSearchPlaceholder" required maxlength="80" autocomplete="off" spellcheck="false" aria-describedby="profile-lookup-hint profile-lookup-status" aria-controls="profile-lookup-options" /><button type="submit" class="accent-button" data-i18n="profileOpen">${t("profileOpen")}</button></div>
        <small id="profile-lookup-hint" data-i18n="profileSearchHint">${t("profileSearchHint")}</small>
        <p id="profile-lookup-status" role="status" aria-live="polite"></p>
        <div id="profile-lookup-options" class="profile-lookup-options" role="group" hidden></div>
      </form>
    </header>
    <div id="profile-content" class="research-content" aria-live="polite"></div>
  </main>
  <main id="country-evidence-workspace" class="research-workspace" data-research-panel="country" hidden>
    <nav class="nested-page-breadcrumb" aria-label="${t("nestedNavigation")}" data-i18n-aria-label="nestedNavigation">
      <button type="button" data-back-to-profile data-research-back><span aria-hidden="true">←</span> <span>${t("returnToCladeSearch")}</span></button><span aria-hidden="true">/</span><strong data-i18n="countryEvidenceTitle">${t("countryEvidenceTitle")}</strong>
    </nav>
    ${scopeNote}
    <header class="research-workspace-heading"><div><h2 id="country-evidence-workspace-title" tabindex="-1" data-i18n="countryEvidenceWorkspaceTitle">${t("countryEvidenceWorkspaceTitle")}</h2><p data-i18n="countryEvidenceWorkspaceCopy">${t("countryEvidenceWorkspaceCopy")}</p></div></header>
    <div id="country-evidence-content" class="research-content" aria-live="polite"></div>
  </main>
  <main id="country-overview-workspace" class="research-workspace" data-research-panel="country-overview" hidden>
    <nav class="nested-page-breadcrumb" aria-label="${t("nestedNavigation")}" data-i18n-aria-label="nestedNavigation">
      <button type="button" data-research-back hidden><span aria-hidden="true">←</span> <span>${t("returnToCountryChoice")}</span></button>
      <span aria-hidden="true">/</span><strong data-i18n="countryOverviewTitle">${t("countryOverviewTitle")}</strong>
    </nav>
    ${scopeNote}
    <header class="research-workspace-heading">
      <div><h2 id="country-overview-workspace-title" tabindex="-1" data-i18n="countryOverviewTitle">${t("countryOverviewTitle")}</h2><p data-i18n="countryOverviewWorkspaceCopy">${t("countryOverviewWorkspaceCopy")}</p></div>
      <form id="country-overview-form" class="profile-lookup">
        <label for="country-overview-select" data-i18n="countryOverviewChoose">${t("countryOverviewChoose")}</label>
        <div class="profile-lookup-controls"><select id="country-overview-select" required></select><button type="submit" class="accent-button" data-i18n="countryOverviewOpen">${t("countryOverviewOpen")}</button></div>
      </form>
    </header>
    <div id="country-overview-content" class="research-content" aria-live="polite"></div>
  </main>`;
}
