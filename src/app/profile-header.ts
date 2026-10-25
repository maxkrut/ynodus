import { escapeHtml as h } from "../shared/html";
import { nodeMacroGroup } from "../shared/haplogroups";
import type { SubcladeProfile } from "../shared/types";
import type { ResearchMarkupOptions } from "./research-markup-shared";
import { renderResearchSampleControl } from "./research-sample-control";
import { renderAnnotation } from "./annotation-markup";
import { ancientNote } from "./sample-scope";

export function renderProfileHeader(profile: SubcladeProfile, path: string, o: ResearchMarkupOptions): string {
  const detail = o.resultDetail?.();
  const countries = [...profile.countryCounts].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]));
  return `<section class="profile-compact-header" aria-label="${h(o.t("subcladeProfileView"))}">
    <div class="profile-compact-identity"><span class="profile-project">${h(nodeMacroGroup(profile.node))}</span>
      <h3>${h(detail?.parentId ? `${detail.parentId} → ${profile.node.id}` : profile.node.id)}</h3>
      ${profile.parent && !detail ? `<button type="button" class="small-button research-up-button" data-open-profile-subclade="${h(profile.parent.id)}" data-profile-parent aria-label="${h(o.t("profileGoToParent").replace("{id}", profile.parent.id))}"><span aria-hidden="true">↑</span> <span>${h(profile.parent.id)}</span></button>` : ""}
      <span class="profile-compact-age">${profile.node.formedKnown ? `~${h(o.formatCalendar(profile.node.formed))}` : h(o.t("dateUnknown"))} ${renderAnnotation("source-age",o.t)}</span>
      <span class="profile-compact-total"><span data-profile-total-label>${h(o.t("profileSubtreeEvidence"))}</span>: <strong data-profile-scope-total>${o.formatNumber(profile.total)}</strong>${detail ? `<span data-profile-scope-ancient>${ancientNote(profile.ancientTotal,o.t,o.formatNumber)}</span>` : ""}</span>
      ${detail ? "" : `<a class="small-button" href="${h(o.subcladeUrl(profile.node.id))}" aria-label="${h(o.t("openInYfull"))}" target="_blank" rel="noreferrer">YFull ↗</a>`}
      ${profile.node.formedKnown && !detail ? `<button class="small-button" type="button" data-search-profile-formed title="${h(o.t("profileTimeSearchHint"))}">${h(o.t("searchNearFormed"))}</button>` : ""}
    </div>
    ${profile.parent ? `<nav class="ancestry-breadcrumb profile-compact-path" aria-label="${h(o.t("profileAncestry"))}">${path}</nav>` : ""}
    <div class="profile-compact-countries" aria-label="${h(o.t("profileNodeCountries"))}">
      <span>${h(o.t(detail ? "resultDetailCountriesList" : "profileCountriesShort"))}: ${o.formatNumber(countries.length)} ${detail ? renderAnnotation("result-detail",o.t) : ""}</span>
      ${countries.slice(0,6).map(([code,count]) => `<button type="button" class="profile-country-chip" data-profile-country="${h(code)}" aria-pressed="false" aria-label="${h(`${o.countryName(code)} (${code})`)}"><span class="flag" aria-hidden="true">${o.countryFlag(code)}</span>${h(o.countryName(code))} <b>${o.formatNumber(count)}</b></button>`).join("")}
      ${countries.length > 6 ? `<label class="profile-countries-more" for="profile-country-filter">+${o.formatNumber(countries.length-6)}</label>` : ""}
    </div>
    <div class="profile-compact-controls">
      ${renderResearchSampleControl("profile-sample-scope",o.t, !!detail)}
      <label class="profile-compact-control" for="profile-country-filter"><span>${h(o.t("profileCountryFilter"))}</span><select id="profile-country-filter" data-profile-country-filter><option value="">${h(o.t("matrixAllCountries"))}</option>${countries.map(([code,count]) => `<option value="${h(code)}">${h(o.countryName(code))} (${h(code)}) · ${o.formatNumber(count)}</option>`).join("")}</select></label>
      <button type="button" class="small-button profile-country-reset" data-profile-country-reset disabled>${h(o.t("profileCountryReset"))}</button>
      <label class="profile-compact-control profile-node-search" for="profile-tree-search"><span>${h(o.t("countryTreeSearch"))}</span><input id="profile-tree-search" type="search" data-profile-tree-search autocomplete="off" spellcheck="false" /></label>
    </div>
  </section>`;
}
