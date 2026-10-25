import { escapeHtml as h } from "../shared/html";
import type { CountryEvidence, SubcladeProfile, TreeNodeRef } from "../shared/types";
import type { TextKey } from "./i18n";
import { renderAnnotation } from "./annotation-markup";
import { globeIconSvg } from "./icons";

type Options = { t: (key: TextKey) => string; formatNumber: (value: number) => string; countryName: (code: string) => string; countryFlag: (code: string) => string };
export function renderCountryBranch(evidence: CountryEvidence, _profile: SubcladeProfile | null,
  selected: string[], { t, countryName, countryFlag }: Options): string {
  const codes = selected.length ? selected : [evidence.country];
  const identity = codes.length === 1
    ? `<span class="country-evidence-flag" aria-hidden="true">${countryFlag(codes[0])}</span><h3>${h(countryName(codes[0]))} <small>${h(codes[0])}</small></h3>`
    : `<div class="branch-country-identity-selection"><h3>${h(t("branchCountriesSelected"))}</h3><div>${codes.slice(0, 3).map(code => `<span><span class="flag" aria-hidden="true">${countryFlag(code)}</span>${h(countryName(code))} <small>${h(code)}</small></span>`).join("")}${codes.length > 3 ? `<span>+ ${codes.length - 3}</span>` : ""}</div></div>`;
  const renderNodes = (nodes: TreeNodeRef[]) => nodes.map(node => `<button type="button" data-country-evidence="${h(evidence.country)}" data-country-evidence-anchor="${h(node.id)}"${node.id === evidence.anchor.id ? ' aria-current="page"' : ""}>${h(node.id)}</button>`).join('<span aria-hidden="true">›</span>');
  const earlier = evidence.path.slice(0, -4);
  const parent = evidence.path.at(-2);
  return `<section class="profile-identity-panel country-evidence-identity">
    <div class="profile-identity-main"><div class="country-identity-name">${identity} ${renderAnnotation("sample-countries", t)}</div>
      <span class="profile-formed"><small>${h(t("branchSelected"))}</small><strong>${h(evidence.anchor.id)}</strong>${parent ? `<button type="button" class="small-button research-up-button" data-country-evidence="${h(evidence.country)}" data-country-evidence-anchor="${h(parent.id)}" aria-label="${h(t("profileGoToParent").replace("{id}",parent.id))}">↑ ${h(parent.id)}</button>` : ""}</span>
    </div>
    <button class="small-button country-all-profile" type="button" data-open-profile-subclade="${h(evidence.anchor.id)}" title="${h(t("branchCountriesProfileHint"))}" aria-label="${h(t("branchCountriesProfileHint"))}">${globeIconSvg()}${h(t("branchCountriesProfile"))}</button>
  </section>
  <nav class="country-branch-path" aria-label="${h(t("profileAncestry"))}">${earlier.length ? `<details class="ancestry-earlier"><summary aria-label="${h(t("earlierAncestors"))}">…</summary><div>${renderNodes(earlier)}</div></details><span aria-hidden="true">›</span>` : ""}${renderNodes(evidence.path.slice(-4))} ${renderAnnotation("research-sources", t)}</nav>
  <section class="profile-section branch-country-section" data-branch-country-tree></section>`;
}
