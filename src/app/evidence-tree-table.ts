import { escapeHtml as h } from "../shared/html";
import type { EvidenceTreeNode, SubcladeProfile } from "../shared/types";
import type { ProfileMatrixOptions } from "./profile-matrix";
import { ancientNote, selectedAncient } from "./sample-scope";
import { renderAnnotation } from "./annotation-markup";
import { matrixCountPaint } from "./matrix-colours";

export type EvidenceTableState = {
  countries?: string[]; opened?: string[]; closed?: string[]; limits?: Array<[string, number]>;
  query?: string; selected?: string; offset?: number; pageSize?: number; branch?: boolean;
};
type Entry = { node: EvidenceTreeNode; parent: Entry | null; depth: number; selected: number; eligible: boolean };
const CHILDREN = 20;

/** Profiles and country forests share real edges. Paging repeats ancestors, never invents parents. */
export function renderEvidenceTreeTable(profile: SubcladeProfile, state: EvidenceTableState, o: ProfileMatrixOptions): string {
  return renderEvidenceForestTable({ roots: [profile.evidenceTree], countryCounts: profile.countryCounts, anchorId: profile.node.id }, state, o);
}

export function renderEvidenceForestTable(profile: { roots: readonly EvidenceTreeNode[]; countryCounts: Map<string, number>; anchorId?: string }, state: EvidenceTableState, o: ProfileMatrixOptions): string {
  const { t, formatNumber: n } = o;
  const forest = profile.anchorId === undefined;
  const allLabel = t(o.terminal?.() ? "matrixAllResultCountries" : "matrixAllCountries");
  const codes = [...profile.countryCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([code]) => code);
  const selected = (state.countries ?? []).filter(code => profile.countryCounts.has(code));
  const filtered = (state.countries?.length ?? 0) > 0 && selected.length < codes.length;
  const scope = filtered ? selected : codes;
  const opened = state.opened ? new Set(state.opened) : null, closed = new Set(state.closed), limits = new Map(state.limits);
  const needle = state.query?.trim().toLocaleUpperCase() ?? "";
  const entries: Entry[] = [], byId = new Map<string, Entry>();
  const pending: Array<{ node: EvidenceTreeNode; parent: Entry | null }> = profile.roots.map(node => ({ node, parent: null })).reverse();
  while (pending.length) {
    const { node, parent } = pending.pop()!;
    const count = filtered ? scope.reduce((sum, code) => sum + (node.countryCounts.get(code) ?? 0), 0) : node.total;
    const entry = { node, parent, depth: parent ? parent.depth + 1 : 0, selected: count,
      eligible: count > 0 && (!needle || node.node.id.toLocaleUpperCase().includes(needle)) };
    entries.push(entry); byId.set(node.node.id, entry);
    for (let i = node.children.length - 1; i >= 0; i--) pending.push({ node: node.children[i], parent: entry });
  }
  if (needle) for (let i = entries.length - 1; i >= 0; i--) if (entries[i].eligible && entries[i].parent) entries[i].parent!.eligible = true;
  const expanded = (entry: Entry) => !!needle || (opened ? opened.has(entry.node.node.id) : !closed.has(entry.node.node.id));
  const visible: Entry[] = [], childMore = new Map<string, number>();
  const queue = entries.filter(entry => !entry.parent).reverse();
  while (queue.length) {
    const entry = queue.pop()!;
    if (!entry.eligible) continue;
    visible.push(entry);
    if (!expanded(entry)) continue;
    const children = entry.node.children.map(node => byId.get(node.node.id)!).filter(child => child.eligible);
    const limit = needle ? children.length : limits.get(entry.node.node.id) ?? CHILDREN;
    if (children.length > limit) childMore.set(entry.node.node.id, children.length - limit);
    for (let i = Math.min(limit, children.length) - 1; i >= 0; i--) queue.push(children[i]);
  }
  const size = Math.max(20, Math.min(100, state.pageSize ?? 100));
  const offset = Math.min(Math.floor((state.offset ?? 0) / size) * size, Math.floor(Math.max(0, visible.length - 1) / size) * size);
  const page = visible.slice(offset, offset + size), included = new Set(page), primary = new Set(page);
  for (const entry of page) for (let parent = entry.parent; parent; parent = parent.parent) included.add(parent);
  const rows = visible.filter(entry => included.has(entry));
  const maximum = Math.max(1, ...profile.countryCounts.values());
  const showAncient = o.ancientBreakdown?.() !== false;
  const cleanTree = forest || (!state.branch && !o.terminal?.());
  const nodeWidth = cleanTree ? Math.max(310, 200 + rows.reduce((max,entry) => Math.max(max,entry.depth),0) * 24) : 310;
  const lastShownChild = new Map<Entry | null,Entry>();
  if (cleanTree) for (const entry of rows) lastShownChild.set(entry.parent,entry);
  const connectors = (entry: Entry) => {
    if (!cleanTree) return "";
    const guides: string[] = [];
    for (let ancestor = entry.parent; ancestor?.parent; ancestor = ancestor.parent) {
      if (lastShownChild.get(ancestor.parent) !== ancestor) guides.push(`<span class="tree-sheet-guide" style="--tree-level:${ancestor.parent.depth}"></span>`);
    }
    if (entry.parent) guides.push(`<span class="tree-sheet-joint${lastShownChild.get(entry.parent) === entry ? " is-last" : ""}" style="--tree-level:${entry.parent.depth}"></span>`);
    if (lastShownChild.has(entry)) guides.push(`<span class="tree-sheet-stem" style="--tree-level:${entry.depth}"></span>`);
    return `<span class="tree-sheet-connectors" aria-hidden="true">${guides.join("")}</span>`;
  };
  const columns = 3 + codes.length + (filtered || state.branch ? 1 : 0);
  const compactAncient = (count: number | undefined) => !showAncient || count === undefined ? "" : `<small class="tree-cell-ancient" aria-label="${h(`${t("ancientSubset")} ${n(count)}`)}">${h(t("matrixAncientShort"))} ${n(count)}</small>`;
  const countryHeader = (code: string) => `<th scope="col" class="tree-country-col"><button type="button" class="matrix-country-heading" data-tree-country="${h(code)}" aria-pressed="${filtered && selected.includes(code)}" aria-label="${h(`${o.countryName(code)} (${code})`)}" data-tooltip="${h(`${o.countryName(code)} · ${t(state.branch || o.terminal?.() ? "matrixCountryFilterHint" : "profileCountryFilterHint")}`)}"><span class="matrix-country-name">${h(o.countryName(code))}</span><span class="flag" aria-hidden="true">${o.countryFlag(code)}</span><small>${h(code)}</small></button></th>`;
  const countryCell = (entry: Entry, code: string) => {
    const value = entry.node.countryCounts.get(code) ?? 0;
    const ancient = showAncient && entry.node.ancientCountryCounts ? entry.node.ancientCountryCounts.get(code) ?? 0 : undefined;
    const content = value ? `${n(value)}${compactAncient(ancient)}` : "–";
    const description = `${o.countryName(code)} · ${entry.node.node.id} · ${n(value)}${ancient === undefined ? "" : ` · ${t("ancientSubset")} ${n(ancient)}`}`;
    const action = value && !o.terminal?.() ? `<button type="button" data-country-evidence="${h(code)}" data-country-evidence-anchor="${h(entry.node.node.id)}" aria-label="${h(description)}">${content}</button>` : content;
    const paint = matrixCountPaint(value,maximum);
    return `<td class="tree-country-cell${filtered && !selected.includes(code) ? " is-muted" : ""}" data-count="${value}" style="background-color:${paint.background};--matrix-count-color:${paint.foreground}">${action}</td>`;
  };
  const row = (entry: Entry) => {
    const { node, parent, depth } = entry, id = node.node.id;
    const children = node.children.some(child => byId.get(child.node.id)!.eligible), open = expanded(entry);
    const tie = !!parent?.node.node.formedKnown && node.node.formedKnown && parent.node.node.formed === node.node.formed;
    const tieLabel = parent ? t("treeParentAgeMatch").replace("{parent}", parent.node.node.id).replace("{age}", n(node.node.formed)) : "";
    const marker = tie && !cleanTree ? `<span class="same-formed-marker" title="${h(tieLabel)}" aria-label="${h(tieLabel)}">≈</span>` : "";
    const inspect = state.branch ? `<strong>${h(id)}${marker}</strong>` : `<button type="button" data-profile-select="${h(id)}" aria-pressed="${id === (state.selected ?? profile.anchorId)}" aria-label="${h(t("profileInspectNode").replace("{id}", id))}">${h(id)}${marker}</button>`;
    const openLink = o.terminal?.() || id === profile.anchorId ? "" : state.branch
      ? `<button type="button" data-country-evidence="${h(codes.find(code => scope.includes(code) && (node.countryCounts.get(code) ?? 0) > 0) ?? scope[0])}" data-country-evidence-anchor="${h(id)}" aria-label="${h(`${t("branchCountriesOpen")}: ${id}`)}">↗</button>`
      : `<button type="button" class="profile-node-open" data-open-profile-subclade="${h(id)}" aria-label="${h(t("profileOpenNode").replace("{id}", id))}">↗</button>`;
    const more = childMore.get(id);
    return `<tr class="evidence-tree-node tree-sheet-row${tie ? " same-formed" : ""}${primary.has(entry) ? "" : " tree-context-row"}${id === state.selected ? " is-selected" : ""}" role="row" aria-level="${depth + 1}"${children ? ` aria-expanded="${open}"` : ""} data-tree-depth="${depth}" data-tree-parent="${h(parent?.node.node.id ?? "")}" data-branch-tree-node="${h(id)}" data-branch-tree-parent="${h(parent?.node.node.id ?? "")}" data-tree-node="${h(id)}"${forest ? ` data-country-tree-node="${h(id)}" data-country-tree-parent="${h(parent?.node.node.id ?? "")}"` : ""}>
      <th scope="row" class="tree-node-col">${connectors(entry)}<div class="tree-sheet-identity" style="--tree-depth:${cleanTree ? depth : Math.min(depth, 10)}">${children ? `<button type="button" class="tree-sheet-toggle" data-evidence-tree-toggle="${h(id)}"${forest ? ` data-country-tree-toggle="${h(id)}"` : ""} aria-expanded="${open}" aria-label="${h(`${t(open ? "countryTreeCollapse" : "countryTreeExpand")}: ${id}`)}">${open ? "▾" : "▸"}</button>` : `<span class="tree-sheet-leaf" aria-hidden="true">${cleanTree ? "" : "·"}</span>`}<span class="profile-node-links">${inspect}${openLink}</span></div>${cleanTree ? "" : `<small class="tree-node-age-mobile">${node.node.formedKnown ? `~${h(o.formatCalendar(node.node.formed))}` : h(t("dateUnknown"))}</small>`}${!cleanTree && depth >= 10 && parent ? `<small class="tree-parent-label">${h(t("treeParent"))}: ${h(parent.node.node.id)}</small>` : ""}${!cleanTree && node.directTotal && node.children.length ? `<small class="tree-direct-label">${h(t("profileNodeDirect"))}: ${n(node.directTotal)}</small>` : ""}${more && open ? `<button class="tree-child-more" type="button" data-evidence-tree-more="${h(id)}" aria-label="${h(t("showMoreBranches"))} · ${n(Math.min(20, more))}">${cleanTree ? "…" : `${h(t("showMoreBranches"))} · ${n(Math.min(20, more))}`}</button>` : ""}</th>
      <td class="tree-age-col">${node.node.formedKnown ? `~${h(o.formatCalendar(node.node.formed))}` : h(t("dateUnknown"))}</td>
      ${codes.map(code => countryCell(entry, code)).join("")}
      ${filtered || state.branch ? `<td class="tree-selected-col"><strong data-branch-tree-selected>${n(entry.selected)}</strong>${showAncient ? ancientNote(selectedAncient(node.ancientCountryCounts, scope), t, n) : ""}</td>` : ""}
      <td class="tree-total-col"><strong data-branch-tree-all>${n(node.total)}</strong>${showAncient ? ancientNote(node.ancientTotal, t, n) : ""}</td></tr>`;
  };
  const progress = t("matrixTreeProgress").replace("{start}", n(visible.length ? offset + 1 : 0)).replace("{end}", n(Math.min(visible.length, offset + size))).replace("{total}", n(visible.length));
  return `<div class="tree-sheet-toolbar"><p>${h(t("profileMatrixHint"))} ${renderAnnotation("sample-counts", t)}</p><span class="matrix-colour-legend"><i aria-hidden="true"></i>1…${n(maximum)} ${renderAnnotation("matrix-colours",t)}</span><div><span>${h(filtered ? scope.map(code => o.countryName(code)).join(", ") : allLabel)}</span>${filtered ? `<button type="button" class="small-button" data-tree-country-reset>${h(allLabel)}</button>` : ""}</div></div>
    <div class="profile-matrix-scroll tree-sheet-scroll" data-tree-offset="${offset}" tabindex="0" role="region" aria-label="${h(t("profileFullTree"))}"><table class="profile-matrix tree-sheet${cleanTree ? ` tree-sheet-clean${nodeWidth > 310 ? " tree-sheet-wide-tree" : ""}` : ""}${state.branch ? " branch-country-matrix" : ""} tree-sheet-matrix" role="treegrid" aria-label="${h(t("profileMatrixMode"))}" style="--tree-sheet-min:${nodeWidth + codes.length * 44 + (filtered || state.branch ? (cleanTree ? 110 : 90) : 0) + 200}px"><colgroup><col class="tree-node-width"><col class="tree-age-width">${codes.map(() => '<col class="tree-country-width">').join("")}${filtered || state.branch ? '<col class="tree-selected-width">' : ""}<col class="tree-total-width"></colgroup><thead><tr><th scope="col">${h(t("tableBranch"))}</th><th scope="col">${h(t("sourceFormationEstimate"))} ${renderAnnotation("source-age", t)}</th>${codes.map(countryHeader).join("")}${filtered || state.branch ? `<th scope="col">${h(t("branchCountriesSelectedColumn"))}</th>` : ""}<th scope="col">${h(t(forest ? "countryTreeTotal" : "branchCountriesAll"))}</th></tr></thead><tbody>${rows.map(row).join("") || `<tr><td colspan="${columns}">${h(t("countryTreeEmpty"))}</td></tr>`}</tbody></table></div>
    <div class="profile-matrix-footer"><span class="evidence-tree-progress" role="status" tabindex="-1" data-evidence-progress="profile-tree">${h(progress)}</span><div><button type="button" class="small-button" data-evidence-tree-page="previous"${offset ? "" : " disabled"}>${h(t("matrixNodesPrevious"))}</button><button type="button" class="small-button" data-evidence-tree-page="next"${offset + size < visible.length ? "" : " disabled"}>${h(t("matrixNodesNext"))}</button></div></div>`;
}

export function bindEvidenceTreeKeys(root: HTMLElement): void {
  root.addEventListener("keydown", event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-evidence-tree-toggle], [data-profile-select]");
    if (!button || !["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const row = button.closest<HTMLElement>("[data-tree-node]")!, table = row.closest("table")!;
    const toggle = row.querySelector<HTMLButtonElement>("[data-evidence-tree-toggle]");
    const rows = [...table.querySelectorAll<HTMLElement>("[data-tree-node]")], index = rows.indexOf(row);
    const focus = (target: HTMLElement | undefined) => target?.querySelector<HTMLElement>("[data-evidence-tree-toggle], [data-profile-select], button")?.focus();
    event.preventDefault();
    if (event.key === "ArrowDown") focus(rows[index + 1]);
    else if (event.key === "ArrowUp") focus(rows[index - 1]);
    else if (event.key === "Home") focus(rows[0]);
    else if (event.key === "End") focus(rows.at(-1));
    else if (event.key === "ArrowRight") { if (toggle?.getAttribute("aria-expanded") === "false") toggle.click(); else if (toggle) focus(rows[index + 1]); }
    else if (toggle?.getAttribute("aria-expanded") === "true") toggle.click();
    else focus(rows.find(candidate => candidate.dataset.treeNode === row.dataset.treeParent));
  });
}
