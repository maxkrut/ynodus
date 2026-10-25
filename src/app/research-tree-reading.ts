import type { EvidenceTreeNode } from "../shared/types";
import { nodeMacroGroup } from "../shared/haplogroups";
import { escapeHtml as h } from "../shared/html";
import { groupFillColor } from "../shared/group-palette";
import type { ProfileMatrixOptions } from "./profile-matrix";

export function compactTreeOpened(roots: readonly EvidenceTreeNode[], macro?: string): string[] {
  if (!macro) return roots.map(root => root.node.id);
  const opened = new Set<string>();
  type Entry = { node: EvidenceTreeNode; parent: Entry | null };
  const pending: Entry[] = roots.map(node => ({ node, parent: null }));
  while (pending.length) {
    const entry = pending.pop()!, { node, parent } = entry;
    const group = nodeMacroGroup(node.node);
    if (group === macro && (!parent || nodeMacroGroup(parent.node.node) !== macro)) {
      for (let current: Entry | null = entry; current && !opened.has(current.node.node.id); current = current.parent) opened.add(current.node.node.id);
    }
    pending.push(...node.children.map(child => ({ node: child, parent: entry })));
  }
  return [...opened];
}

export function toggleResearchNode(state: { opened?: string[]; closed?: string[]; query?: string; searchClosed?: string[] }, id: string): void {
  if (state.query?.trim()) {
    const closed = new Set(state.searchClosed);
    if (closed.has(id)) closed.delete(id); else closed.add(id);
    state.searchClosed = [...closed]; return;
  }
  const explicit = state.opened !== undefined, ids = new Set(explicit ? state.opened : state.closed);
  if (ids.has(id)) ids.delete(id); else ids.add(id);
  if (explicit) state.opened = [...ids]; else state.closed = [...ids];
}

export function researchMacroSelect(groups: readonly string[], o: Pick<ProfileMatrixOptions, "t">): string {
  return `<label class="profile-compact-control"><span>${h(o.t("researchMacrogroup"))}</span><select data-research-macro><option value="">${h(o.t("researchMacroAll"))}</option>${[...new Set(groups)].sort().map(group => `<option value="${h(group)}">${h(group)}</option>`).join("")}</select></label>`;
}

export function treeMacroGroups(roots: readonly EvidenceTreeNode[]): string[] {
  const groups = new Set<string>(), pending = [...roots];
  while (pending.length) { const node = pending.pop()!; groups.add(nodeMacroGroup(node.node)); pending.push(...node.children); }
  return [...groups].sort();
}

/** Scope roots are displayed like a profile; their real source paths stay explicit. */
export function macroResearchForest(roots: readonly EvidenceTreeNode[], macro: string) {
  const result: Array<{ node: EvidenceTreeNode; path: EvidenceTreeNode[] }> = [];
  type Entry = { node: EvidenceTreeNode; parent: Entry | null };
  const pending: Entry[] = roots.map(node => ({ node, parent: null })).reverse();
  while (pending.length) {
    const entry = pending.pop()!, { node, parent } = entry;
    if (nodeMacroGroup(node.node) === macro) {
      const path: EvidenceTreeNode[] = [];
      for(let ancestor=parent;ancestor;ancestor=ancestor.parent)path.push(ancestor.node);
      result.push({ node, path: path.reverse() }); continue;
    }
    for (let i = node.children.length - 1; i >= 0; i--) pending.push({ node: node.children[i], parent: entry });
  }
  return result;
}

export function macroResearchPaths(entries: ReturnType<typeof macroResearchForest>, o: Pick<ProfileMatrixOptions, "t">): string {
  return `<div class="research-macro-paths">${entries.map(({node,path}) => `<div><span><b>${h(node.node.id)}</b>${path.length ? ` · ${h(o.t("treeParent"))}: ${h(path[path.length-1].node.id)}` : ""}</span>${path.length ? `<details><summary>${h(o.t("profileAncestry"))}</summary><p>${[...path,node].map(item=>h(item.node.id)).join(" › ")}</p></details>` : ""}</div>`).join("")}</div>`;
}

/** Country columns include descendants; subtract immediate children once to partition terminal assignments. */
export function researchMacroSummary(roots: readonly EvidenceTreeNode[], countries: readonly string[], o: Pick<ProfileMatrixOptions, "t" | "formatNumber">): string {
  const totals = new Map<string, number>(), pending = [...roots];
  while (pending.length) {
    const node = pending.pop()!;
    const total = countries.length ? countries.reduce((sum, code) => sum + (node.countryCounts.get(code) ?? 0)
      - node.children.reduce((children, child) => children + (child.countryCounts.get(code) ?? 0), 0), 0) : node.directTotal;
    if (total > 0) { const group = nodeMacroGroup(node.node); totals.set(group, (totals.get(group) ?? 0) + total); }
    pending.push(...node.children);
  }
  const entries = [...totals].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const sum = entries.reduce((total, [, value]) => total + value, 0);
  const percent = (value: number) => value / sum < .001 ? `&lt;${o.formatNumber(.1)}` : o.formatNumber(Math.round(1000 * value / sum) / 10);
  return `<p class="research-reading-note">${h(o.t("researchBrowseGroups"))}</p><div class="research-macro-summary">${entries.map(([group, value]) => `<button type="button" data-research-group="${h(group)}" aria-label="${h(o.t("researchGroupOpen").replace("{group}", group))}"><span aria-hidden="true">▸</span><strong>${h(group)}</strong><span class="research-macro-track" aria-hidden="true"><i style="width:${100 * value / sum}%;background:${groupFillColor(group)}"></i></span><b>${o.formatNumber(value)}</b><small>${percent(value)}%</small></button>`).join("")}</div><p class="research-reading-note">${h(o.t("researchGroupSamples"))}</p>`;
}
