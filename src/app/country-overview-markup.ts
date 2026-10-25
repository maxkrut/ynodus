import type { CountryOverview } from "../shared/types";
import type { ResearchMarkupOptions } from "./research-markup-shared";
import { escapeHtml as h } from "../shared/html";
import { researchMacroSelect } from "./research-tree-reading";
import { renderAnnotation } from "./annotation-markup";
import { renderResearchSampleControl } from "./research-sample-control";

type Options = Pick<ResearchMarkupOptions, "t" | "formatNumber" | "countryName" | "countryFlag">;
export function renderCountryOverviewMarkup(overview: CountryOverview, o: Options): string {
  const codes=[overview.country,...(overview.countries??[]).filter(code=>code!==overview.country)];
  const counts=overview.countryCounts ?? new Map([[overview.country,overview.total]]);
  return `<section class="profile-compact-header country-compact-header" aria-label="${h(o.t("countryOverviewTitle"))}">
    <div class="profile-compact-identity"><span class="country-evidence-flag" aria-hidden="true">${o.countryFlag(overview.country)}</span><h3>${h(o.countryName(overview.country))} <small>${h(overview.country)}</small></h3>
      ${renderAnnotation("sample-countries",o.t)}<span class="profile-compact-total country-overview-total"><span>${h(o.t("countryComparisonTotal"))}</span>: <strong>${o.formatNumber(overview.total)}</strong> ${renderAnnotation("country-overview-total",o.t)}</span>
    </div>
    <div class="profile-compact-path"><span>${h(o.t("countryComparisonScope"))}</span> ${renderAnnotation("missing-records",o.t)}</div>
    <div class="profile-compact-countries"${codes.length === 1 ? " hidden" : ""}>${codes.slice(0,6).map(code=>`<span class="country-comparison-chip"><span class="flag" aria-hidden="true">${o.countryFlag(code)}</span>${h(o.countryName(code))} <b>${o.formatNumber(counts.get(code)??0)}</b>${code!==overview.country?`<button type="button" data-country-comparison-remove="${h(code)}" aria-label="${h(o.t("countryComparisonRemove").replace("{country}",o.countryName(code)))}">×</button>`:""}</span>`).join("")}${codes.length>6?`<button type="button" class="small-button" data-country-comparison-open>+${o.formatNumber(codes.length-6)}</button>`:""}</div>
    <div class="profile-compact-controls">${renderResearchSampleControl("overview-sample-scope",o.t)}
      <button type="button" class="small-button country-comparison-open" data-country-comparison-open>${h(o.t("countryComparisonChoose"))} · ${o.formatNumber(codes.length)}</button>
      <label class="profile-compact-control"><span>${h(o.t("profileCountryFilter"))}</span><select data-country-tree-filter><option value="">${h(o.t("matrixAllCountries"))}</option>${codes.map(code=>`<option value="${h(code)}">${h(o.countryName(code))} (${h(code)})</option>`).join("")}</select></label>
      <button type="button" class="small-button profile-country-reset" data-tree-country-reset disabled>${h(o.t("profileCountryReset"))}</button>
      ${researchMacroSelect(overview.groups.map(group => group.project), o)}
      <button type="button" class="small-button" data-research-collapse>${h(o.t("researchMacroReset"))}</button>
      <button type="button" class="small-button" data-research-expand>${h(o.t("researchExpand"))}</button>
      <label class="profile-compact-control profile-node-search" for="country-tree-search"><span>${h(o.t("countryTreeSearch"))}</span><input id="country-tree-search" type="search" data-country-tree-search autocomplete="off" spellcheck="false"></label>
    </div>
  </section>
  <div data-country-comparison-picker></div>
  <details class="profile-inspector-disclosure" data-country-node-details><summary>${h(o.t("profileNodeDetails"))}</summary><aside class="profile-node-inspector" data-profile-inspector></aside></details>
  <section class="profile-section profile-tree-section country-tree-section" data-country-tree><header><h3>${h(o.t("countryTreeTitle"))}</h3><span class="annotated-label">${h(o.t("countryTreeAssignments"))}: ${o.formatNumber(overview.assignments.length)} ${renderAnnotation("country-assignments",o.t)}</span></header><div data-country-tree-body></div></section>
  `;
}
