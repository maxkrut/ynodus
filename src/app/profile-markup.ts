import { ancientNote } from "./sample-scope";
import { escapeHtml } from "../shared/html";
import { pluralLabel } from "../shared/plural";
import type { EvidenceTreeNode, Locale, ResultRow, SubcladeProfile, TreeNodeRef } from "../shared/types";
import { formedBranchDetails } from "../results/formed-branch-model";
import { renderAnnotation } from "./annotation-markup";
import { EVIDENCE_REVEAL_INCREMENT, type EvidenceRevealKind, type ResearchMarkup, type ResearchMarkupOptions } from "./research-markup-shared";
import { renderProfileMatrix } from "./profile-matrix";
import { renderProfileHeader } from "./profile-header";



/** Standalone profiles and terminal result details share their scoped presentation. */
export function createProfileMarkup(
  options: ResearchMarkupOptions,
  revealLimit: (kind: EvidenceRevealKind) => number,
): Pick<ResearchMarkup, "profile" | "profileInspector"> {
  function profile(profile: SubcladeProfile): string {
    const detail = options.resultDetail?.();
    const sameFormedLinks = countSameFormedLinks(profile.evidenceTree);
    const queryRow = detail?.mode === "crossing" ? undefined : options.queryFormedRow?.(profile.node.id);
    const groups = detail && queryRow && !queryRow.crossingChild ? renderProfileFormedGroups(queryRow, revealLimit("profile-formed")) : "";
    const inspector = `<aside class="profile-node-inspector" data-profile-inspector aria-live="polite">${profileInspector(profile.evidenceTree, true)}</aside>`;
    return `${renderProfileHeader(profile, renderPath(profile.path, true), options)}
      <details class="profile-inspector-disclosure" data-profile-inspector-disclosure><summary title="${escapeHtml(options.t("profileSelectHint"))}">${escapeHtml(options.t("profileNodeDetails"))}</summary>${inspector}</details>
      <div class="profile-columns profile-explorer" data-profile-tree-view>
        <section class="profile-section profile-tree-section">
          <header><h3>${escapeHtml(options.t("profileFullTree"))}</h3></header>
          <div data-profile-tree-table>${renderProfileMatrix(profile, 100, 0, { ...options, terminal: () => !!detail, ancientBreakdown: () => false })}</div>
        </section>
      </div>
      ${groups ? `<details class="profile-extra" data-profile-extra="formed"><summary>${escapeHtml(options.t("branchStructureTitle"))}</summary>${groups}</details>` : ""}
      <details class="profile-extra" data-profile-extra="details"><summary>${escapeHtml(options.t("profileDetails"))}</summary><p>${escapeHtml(options.t("profileDatedDescendants"))}: <strong>${options.formatNumber(profile.datedDescendantCount)}</strong></p><p>${escapeHtml(options.t("profileDatedDescendantsHint"))}</p>${sameFormedLinks > 0 ? `<p data-tree-age-pairs>${escapeHtml(options.t("treeSameAgePairs"))}: <strong>${options.formatNumber(sameFormedLinks)}</strong> ${renderAnnotation("tree-age-pairs", options.t)}</p>` : ""}</details>`;
  }

  function profileInspector(node: EvidenceTreeNode, isRoot: boolean, countryScope = false): string {
    const countries = [...node.countryCounts].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]));
    const detail = options.resultDetail?.();
    const countryList = `${countries.length > 4 ? `<label class="profile-country-search"><span>${escapeHtml(options.t("profileCountrySearch"))}</span><input id="profile-country-search" type="search" data-profile-country-search placeholder="${escapeHtml(options.t("profileCountrySearch"))}" /></label>` : ""}
      <p data-profile-country-empty role="status" hidden>${escapeHtml(options.t("profileCountryEmpty"))}</p>
      ${countryEvidenceList(countries,node.node.id,revealLimit("profile-countries"),"profile-countries")}`;
    return `<section class="profile-section profile-selected-summary${isRoot ? " is-root" : ""}">
      ${isRoot ? "" : `<span class="profile-selected-label">${escapeHtml(options.t("profileSelectedNode"))}</span><h3>${escapeHtml(node.node.id)}</h3>`}
      <div class="profile-selected-metric">${metric(options.t(countryScope ? "branchCountriesSelectedColumn" : "profileSubtreeEvidence"),node.total,options.t("profileSubtreeEvidenceHint"),detail ? node.ancientTotal : undefined,true)}</div>
      ${!detail || node.directTotal > 0 ? `<p class="profile-selected-direct">${escapeHtml(options.t("profileNodeDirect"))}: <b>${options.formatNumber(node.directTotal)}</b></p>` : ""}
      ${isRoot ? "" : `<p class="profile-selected-age">${escapeHtml(options.t("sourceFormationEstimate"))} ${renderAnnotation("source-age",options.t)}<br><b>${node.node.formedKnown ? `~${escapeHtml(options.formatCalendar(node.node.formed))}` : escapeHtml(options.t("dateUnknown"))}</b>${node.node.formedKnown ? ` · ${options.formatNumber(node.node.formed)} YBP ${renderAnnotation("calendar",options.t)}` : ""}</p>`}
      ${isRoot || options.resultDetail?.() ? "" : `<button class="small-button" type="button" data-open-profile-subclade="${escapeHtml(node.node.id)}">${escapeHtml(options.t("profileOpenNode").replace("{id}",node.node.id))} ↗</button>`}
    </section>
    <section class="profile-section country-evidence-list">
      <header><h3>${escapeHtml(options.t("profileNodeCountries"))} ${renderAnnotation("sample-countries",options.t)}</h3><span>${countryCountText(countries.length)} ${renderAnnotation("missing-records",options.t)}</span></header>
      ${countries.length > 3 ? `<details class="result-country-disclosure" data-profile-countries><summary><span>${escapeHtml(options.t("resultDetailCountriesList"))}</span><span class="result-country-preview" aria-hidden="true">${countries.slice(0,3).map(([code]) => `<span><span class="flag">${options.countryFlag(code)}</span>${escapeHtml(code)}</span>`).join("")}<span>+${options.formatNumber(countries.length - 3)}</span></span></summary><div class="result-country-body">${countryList}</div></details>` : countryList}
    </section>`;
  }

  function renderProfileFormedGroups(row: ResultRow, limit: number): string {
    const events = formedBranchDetails(row).events;
    if (events.length === 1 && events[0].formedMembers.length === 1) return "";
    const sameAgeGroups = events.filter(event => event.formedMembers.length > 1);
    const sameAgeDescendants = sameAgeGroups.reduce((count, event) => count + event.formedMembers.length - 1, 0);
    const shown = events.slice(0, limit).map((event, index) => {
      const otherMembers = event.formedMembers.filter(member => member.node.id !== event.node.id);
      const countries = [...event.countryCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      return `<article class="profile-formed-group${otherMembers.length ? " has-same-formed" : ""}" data-profile-formed-event="${escapeHtml(event.node.id)}">
        <div class="profile-formed-group-head">
          <strong>${escapeHtml(event.node.id)}</strong>
          <time>~${escapeHtml(options.formatCalendar(event.node.formed))}</time>
          <span>${escapeHtml(options.t(index === 0 ? "branchRootEvidence" : "nestedEventEvidence"))}: <b>${options.formatNumber(event.total)}</b>${ancientNote(event.ancientTotal, options.t, options.formatNumber)}</span>
        </div>
        ${event.parentEventId ? `<small>${escapeHtml(event.viaParentId ?? event.parentEventId)} → ${escapeHtml(event.node.id)}</small>` : ""}
        ${otherMembers.length ? `<p class="profile-same-formed-members"><span>${escapeHtml(options.t("branchSameAgeTitle"))}: ${options.formatNumber(otherMembers.length)}</span> ${otherMembers.map(member => `<span>${escapeHtml(member.node.id)}</span>`).join("")}</p>` : ""}
        <div class="profile-formed-countries" aria-label="${escapeHtml(options.t("branchCountriesTitle"))}">${countries.map(([code, count]) => `<span><span class="flag" aria-hidden="true">${options.countryFlag(code)}</span>${escapeHtml(code)} <b>${options.formatNumber(count)}</b></span>`).join("")}</div>
      </article>`;
    }).join("");
    return `<section class="profile-section profile-formed-context">
      <header><h3>${escapeHtml(options.t("branchStructureTitle"))}</h3><span>${escapeHtml(options.t("profileSameAgeCount").replace("{members}", options.formatNumber(sameAgeDescendants)).replace("{groups}", options.formatNumber(sameAgeGroups.length)))}</span></header>
      <p class="section-reading-note">${escapeHtml(options.t("branchStructureHint"))}</p>
      <div class="profile-formed-groups" data-evidence-list="profile-formed" data-evidence-progress="profile-formed" tabindex="-1">${shown}</div>
      ${revealButton("profile-formed", events.length, limit)}
    </section>`;
  }

  function metric(label: string, value: number, hint: string, ancient?: number, compact = false): string {
    return `<article><span>${escapeHtml(label)} ${renderAnnotation(compact ? "branch-counts" : "sample-counts", options.t)}</span><strong>${options.formatNumber(value)}${ancientNote(ancient, options.t, options.formatNumber)}</strong>${compact ? "" : `<small>${escapeHtml(hint)}</small>`}</article>`;
  }

  function countryCountText(count: number): string {
    const noun = pluralLabel(
      options.locale?.() ?? inferredLocale(),
      count,
      options.t("country"),
      options.t("countriesFew"),
      options.t("countriesPlural"),
    );
    return `${options.formatNumber(count)} ${escapeHtml(noun)}`;
  }

  function inferredLocale(): Locale {
    if (options.t("country") === "страна") return "ru";
    return "en";
  }

  function countryEvidenceList(
    entries: Array<[string, number]>,
    anchorId: string,
    limit: number,
    revealKind: EvidenceRevealKind,
  ): string {
    const renderCountry = ([code, count]: [string, number]) => countryEvidenceButton(code, count, anchorId);
    const visible = entries.map((entry, index) => `<div data-country-search-text="${escapeHtml(`${entry[0]} ${options.countryName(entry[0])}`.toLocaleLowerCase())}" data-country-collapsed="${index >= limit}"${index >= limit ? " hidden" : ""}>${renderCountry(entry)}</div>`).join("");
    return `<div class="evidence-list" data-evidence-list="${revealKind}" data-evidence-progress="${revealKind}" tabindex="-1" aria-label="${escapeHtml(options.t("profileNodeCountries"))}">${visible}</div>${revealButton(revealKind, entries.length, limit)}`;
  }

  function revealButton(kind: EvidenceRevealKind, total: number, visible: number): string {
    const remaining = Math.max(0, total - visible);
    if (remaining === 0) return "";
    const nextCount = Math.min(remaining, EVIDENCE_REVEAL_INCREMENT);
    return `<button class="evidence-reveal-button small-button" type="button" data-reveal-evidence="${kind}">
      ${escapeHtml(options.t(kind === "profile-countries" ? "profileMoreCountries" : kind === "profile-formed" ? "showMoreTree" : kind.endsWith("branches") ? "showMoreBranches" : "showMoreAssignments"))} · ${options.formatNumber(nextCount)}
      <span class="visually-hidden"> (${options.formatNumber(remaining)} ${escapeHtml(options.t("remainingItems"))})</span>
    </button>`;
  }

  function countryEvidenceButton(code: string, count: number, anchorId: string): string {
    const label = `${options.t("viewCountryEvidence")}: ${options.countryName(code)} (${code})`;
    const terminal = !!options.resultDetail?.();
    return `${terminal ? '<div class="country-evidence-row">' : `<button class="country-evidence-row" type="button" data-country-evidence="${escapeHtml(code)}" data-country-evidence-anchor="${escapeHtml(anchorId)}" aria-label="${escapeHtml(label)}">`}
      <span class="flag" aria-hidden="true">${options.countryFlag(code)}</span>
      <span><small>${escapeHtml(options.countryName(code))}</small><strong>${escapeHtml(code)}</strong></span>
      <em>${options.formatNumber(count)}</em>
      ${terminal ? "" : '<span aria-hidden="true">›</span>'}
    </${terminal ? "div" : "button"}>`;
  }

  function renderPath(path: TreeNodeRef[], full = false): string {
    const renderNodes = (nodes: TreeNodeRef[]) => nodes.map((node) => {
      const url = options.resultDetail?.() ? null : options.subcladeUrl(node.id);
      return url
        ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(node.id)}</a>`
        : `<span>${escapeHtml(node.id)}</span>`;
    }).join('<span aria-hidden="true">›</span>');
    return full ? renderNodes(path) : `${path.length > 4 ? `<details class="ancestry-earlier"><summary aria-label="${escapeHtml(options.t("earlierAncestors"))}" title="${escapeHtml(options.t("earlierAncestors"))}">…</summary><div>${renderNodes(path.slice(0, -4))}</div></details><span aria-hidden="true">›</span>` : ""}${renderNodes(path.slice(-4))}`;
  }

  return { profile, profileInspector };
}

function countSameFormedLinks(root: EvidenceTreeNode): number {
  let count = 0;
  const pending = [root];
  while (pending.length) {
    const parent = pending.pop()!;
    for (const child of parent.children) {
      if (parent.node.formedKnown && child.node.formedKnown && parent.node.formed === child.node.formed) count += 1;
      pending.push(child);
    }
  }
  return count;
}
