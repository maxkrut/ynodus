import { escapeHtml as h } from "../shared/html";
import type { SubcladeProfile } from "../shared/types";
import { ancientNote, selectedAncient } from "./sample-scope";
import { renderAnnotation } from "./annotation-markup";
import { evidenceCountLabel } from "./evidence-count-label";
import type { ProfileMatrixOptions } from "./profile-matrix";

export function renderBranchCountrySidebar(profile: SubcladeProfile, countries: string[], o: ProfileMatrixOptions): string {
  const {t, formatNumber: n} = o;
  const codes = [...new Set([...profile.countryCounts.keys(),...countries])].sort((a,b)=>Number(countries.includes(b))-Number(countries.includes(a)) || o.countryName(a).localeCompare(o.countryName(b)));
  const selected = countries.reduce((s,c)=>s+(profile.countryCounts.get(c) ?? 0),0);
  const summary = t("branchSelectionCount").replace("{selected}",n(countries.length)).replace("{total}",n(codes.length));
  return `<aside class="branch-country-sidebar" aria-label="${h(t("branchCountries"))}">
    <h3 class="annotated-label"><span>${h(t("branchCountries"))}</span>${renderAnnotation("sample-countries",t)}</h3>
    <details class="branch-country-sidebar-picker" open><summary id="branch-country-selector">${h(summary)}</summary>
    <div class="branch-country-picker-body"><label>${h(t("branchCountriesSearch"))}<input id="branch-country-search" type="search" data-branch-country-search autocomplete="off"></label>
      <div class="branch-country-options">${codes.map(c=>`<label data-branch-country-option="${h(`${c} ${o.countryName(c)}`.toLocaleLowerCase())}"><input type="checkbox" data-branch-country-choice="${h(c)}" value="${h(c)}"${countries.includes(c) ? " checked" : ""}><span class="flag" aria-hidden="true">${o.countryFlag(c)}</span><span>${h(o.countryName(c))} <small>${h(c)}</small></span><strong>${n(profile.countryCounts.get(c) ?? 0)}</strong></label>`).join("")}</div>
      <p class="branch-country-required" data-branch-country-required role="status" hidden>${h(t("branchCountriesRequired"))}</p>
      <p class="branch-country-required" data-branch-country-pending role="status" hidden>${h(t("branchSelectionPending"))}</p>
      <button class="small-button" type="button" data-branch-country-apply disabled>${h(t("branchCountriesApply"))}</button>
      <small>${h(t("branchCountriesIndependent"))}</small>
    </div></details>
    <section class="profile-ledger branch-country-ledger" aria-label="${h(t("countryEvidenceTitle"))}">
      <article><span class="annotated-label"><span>${h(t("branchCountriesAll"))}</span>${renderAnnotation("branch-counts",t)}</span><strong data-branch-scope-all>${h(evidenceCountLabel(profile.total,"sample",t,n))}${ancientNote(profile.ancientTotal,t,n)}</strong></article>
      <article><span class="annotated-label"><span>${h(t("branchCountriesSelectedSamples"))}</span>${renderAnnotation("missing-records",t)}</span><strong data-branch-scope-selected>${h(evidenceCountLabel(selected,"sample",t,n))}${ancientNote(selectedAncient(profile.ancientCountryCounts,countries),t,n)}</strong></article>
    </section>
  </aside>`;
}
