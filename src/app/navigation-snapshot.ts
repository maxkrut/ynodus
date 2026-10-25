import type { AppState } from "./state";
import type { ResearchHistoryRoute } from "./research-history";
import type { EvidenceRevealKind } from "./research-markup";
import { safeClade } from "./research-history";
import { isTableSortKey } from "../results/sorting";
import type { CountryTreeState } from "./country-overview-tree";
import type { BranchTreeState } from "./branch-country-tree";
import type { ProfileExplorerState } from "./profile-explorer";

const FOCUS_ATTRIBUTES = ["id", "data-open-result-detail", "data-open-profile-subclade", "data-country-evidence-anchor",
  "data-country-evidence", "data-profile-option", "data-country-tree-toggle",
  "data-country-tree-more", "data-branch-tree-toggle", "data-branch-tree-more", "data-reveal-evidence",
  "data-profile-select",
  "data-evidence-tree-toggle", "data-evidence-tree-more", "data-evidence-tree-page", "data-tree-country", "data-tree-country-reset"] as const;
type Focus = { attribute: typeof FOCUS_ATTRIBUTES[number]; value: string; country?: string; mode?: string; occurrence?: number };
export type NavigationSnapshot = {
  scroll: number;
  focus?: Focus;
  lookup: string;
  countrySearch: string;
  countryChoice: string;
  tree?: CountryTreeState;
  branchTree?: BranchTreeState;
  profileExplorer?: ProfileExplorerState;
  details: number[];
  innerScroll: Array<[number, number, number]>;
  reveals: Partial<Record<EvidenceRevealKind, number>>;
  time: Pick<AppState, "tableSort" | "crossingTableSort" | "tableRowLimit" | "crossingTableRowLimit" | "resultMacroGroup" | "crossingMacroGroup">;
};
const REVEALS: EvidenceRevealKind[] = ["profile-countries", "profile-branches", "profile-tree", "profile-formed", "country-branches", "country-assignments"];
const panelSelector = (route: ResearchHistoryRoute) => `[data-research-panel="${route.view}"]`;
const SCROLL_CONTAINERS = ".evidence-tree-viewport, .profile-formed-groups, .table-wrap, .profile-matrix-scroll";
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
const text = (value: unknown, limit: number) => typeof value === "string" ? value.slice(0, limit) : "";
const count = (value: unknown, fallback = 0) => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 1_000_000 ? Number(value) : fallback;

/** Saved navigation contains public identifiers and presentation metadata, never result payloads. */
export function readNavigationSnapshot(value: unknown): NavigationSnapshot | undefined {
  const raw = record(value), time = record(raw.time);
  if (typeof raw.scroll !== "number" || !Number.isFinite(raw.scroll) || !time.tableSort) return;
  const sort = (value: unknown): AppState["tableSort"] => {
    const raw = record(value);
    const key = typeof raw.key === "string" ? raw.key : undefined;
    return { key: isTableSortKey(key) ? key : "total", direction: raw.direction === "asc" ? "asc" : "desc" };
  };
  const reveals: NavigationSnapshot["reveals"] = {};
  for (const key of REVEALS) if (record(raw.reveals)[key] !== undefined) reveals[key] = count(record(raw.reveals)[key], 20);
  const focus = record(raw.focus);
  const attribute = FOCUS_ATTRIBUTES.find(name => name === focus.attribute);
  const focusValue = safeClade(focus.value);
  const tree = record(raw.tree);
  const branch = record(raw.branchTree);
  const explorer = record(raw.profileExplorer);
  const limits: Array<[string, number]> = Array.isArray(tree.limits) ? tree.limits.slice(0, 2048)
    .filter(row => Array.isArray(row) && safeClade(row[0])).map(row => [row[0], count(row[1], 20)]) : [];
  return {
    scroll: Math.max(0, Math.min(20_000_000, raw.scroll)),
    focus: attribute && focusValue ? { attribute, value: focusValue,
      country: /^[A-Z]{3}$/.test(String(focus.country)) ? String(focus.country) : undefined,
      mode: focus.mode === "crossing" ? "crossing" : focus.mode === "formed" ? "formed" : undefined,
      occurrence: count(focus.occurrence) } : undefined,
    lookup: text(raw.lookup, 80), countrySearch: text(raw.countrySearch, 120),
    countryChoice: /^[A-Z]{3}$/.test(String(raw.countryChoice)) ? String(raw.countryChoice) : "",
    tree: tree.country && /^[A-Z]{3}$/.test(String(tree.country)) ? {
      country: String(tree.country), query: text(tree.query, 100), limits,
      closed: Array.isArray(tree.closed) ? tree.closed.slice(0,2048).map(safeClade).filter((id): id is string => !!id) : [],
      countries: Array.isArray(tree.countries) ? tree.countries.filter((code): code is string => typeof code === "string" && /^[A-Z]{3}$/.test(code)).slice(0,300) : [],
      offset: count(tree.offset), treeScrollLeft: count(tree.treeScrollLeft), selected: safeClade(tree.selected) ?? undefined, inspectorOpen: tree.inspectorOpen === true,
    } : undefined,
    branchTree: safeClade(branch.anchor) ? {
      offset: count(branch.offset),
      anchor: safeClade(branch.anchor)!, query: text(branch.query, 100),
      treeScrollLeft: count(branch.treeScrollLeft),
      opened: Array.isArray(branch.opened) ? branch.opened.slice(0, 2048).map(safeClade).filter((id): id is string => !!id) : [],
      limits: Array.isArray(branch.limits) ? branch.limits.slice(0, 2048).filter(row => Array.isArray(row) && safeClade(row[0])).map(row => [row[0], count(row[1], 20)]) : [],
    } : undefined,
    reveals,
    profileExplorer: safeClade(explorer.anchor) ? {
      anchor: safeClade(explorer.anchor)!, selected: safeClade(explorer.selected) ?? safeClade(explorer.anchor)!,
      rows: Math.max(20,count(explorer.rows,20)), offset: count(explorer.offset),
      countryScroll: count(explorer.countryScroll),
      countriesOpen: explorer.countriesOpen === true,
      inspectorOpen: explorer.inspectorOpen === true,
      treeScrollLeft: count(explorer.treeScrollLeft),
      countries: Array.isArray(explorer.countries) ? [...new Set(explorer.countries.filter(code => typeof code === "string" && /^[A-Z]{3}$/.test(code)))].slice(0, 300) as string[] : [],
      query: text(explorer.query, 100),
      closed: Array.isArray(explorer.closed) ? explorer.closed.slice(0, 2048).map(safeClade).filter((id): id is string => !!id) : [],
      limits: Array.isArray(explorer.limits) ? explorer.limits.slice(0, 2048).filter(row => Array.isArray(row) && safeClade(row[0])).map(row => [row[0], count(row[1], 20)] as [string, number]) : [],
    } : undefined,
    details: Array.isArray(raw.details) ? raw.details.filter(Number.isSafeInteger).map(value => count(value)) : [],
    innerScroll: Array.isArray(raw.innerScroll) ? raw.innerScroll.filter(row => Array.isArray(row) && row.length === 3)
      .map(row => [count(row[0]), count(row[1]), count(row[2])]) : [],
    time: { tableSort: sort(time.tableSort), crossingTableSort: sort(time.crossingTableSort),
      tableRowLimit: count(time.tableRowLimit, 50), crossingTableRowLimit: count(time.crossingTableRowLimit, 50),
      resultMacroGroup: safeClade(time.resultMacroGroup), crossingMacroGroup: safeClade(time.crossingMacroGroup) },
  };
}

export function captureNavigationSnapshot(state: AppState, route: ResearchHistoryRoute,
  reveals: Record<EvidenceRevealKind, number>, tree?: CountryTreeState, branchTree?: BranchTreeState, profileExplorer?: ProfileExplorerState): NavigationSnapshot {
  const value = (selector: string) => document.querySelector<HTMLInputElement>(selector)?.value ?? "";
  const active = document.activeElement;
  const root = document.querySelector<HTMLElement>(panelSelector(route));
  let focus: Focus | undefined;
  if (active && typeof active.getAttribute === "function") {
    for (const attribute of FOCUS_ATTRIBUTES) {
      const id = safeClade(active.getAttribute(attribute));
      if (!id) continue;
      focus = { attribute, value: id, country: active.getAttribute("data-country-evidence") ?? undefined,
        mode: active.closest("table")?.getAttribute("data-result-mode") ?? undefined };
      focus.occurrence = [...(root?.querySelectorAll(focusSelector(focus)) ?? [])].indexOf(active);
      break;
    }
  }
  return { scroll: typeof window.scrollY === "number" ? window.scrollY : 0, focus,
    lookup: value("#profile-clade-search"), countrySearch: value("[data-profile-country-search]"),
    countryChoice: value("#country-overview-select"), tree: route.view === "country-overview" ? tree : undefined,
    branchTree: route.view === "country" ? branchTree : undefined,
    profileExplorer: route.view === "profile" ? profileExplorer : undefined,
    details: [...(root?.querySelectorAll<HTMLDetailsElement>("details") ?? [])].flatMap((node, index) => node.open ? [index] : []),
    innerScroll: [...(root?.querySelectorAll<HTMLElement>(SCROLL_CONTAINERS) ?? [])]
      .map((node, index) => [index, node.scrollTop, node.scrollLeft]),
    reveals: { ...reveals }, time: { tableSort: { ...state.tableSort }, crossingTableSort: { ...state.crossingTableSort },
      tableRowLimit: state.tableRowLimit, crossingTableRowLimit: state.crossingTableRowLimit,
      resultMacroGroup: state.resultMacroGroup, crossingMacroGroup: state.crossingMacroGroup } };
}

export function applyNavigationSnapshot(state: AppState, snapshot: NavigationSnapshot,
  reveals: Record<EvidenceRevealKind, number>): void {
  Object.assign(state, snapshot.time);
  Object.assign(reveals, snapshot.reveals);
}

export function restoreNavigationInputs(route: ResearchHistoryRoute, snapshot: NavigationSnapshot): void {
  const set = (selector: string, value: string, notify = false) => {
    const input = document.querySelector<HTMLInputElement>(selector);
    if (!input || typeof input.value !== "string") return;
    input.value = value;
    if (notify) input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  if (route.view === "profile") {
    set("#profile-clade-search", snapshot.lookup, snapshot.lookup !== (route.clade ?? ""));
    set("[data-profile-country-search]", snapshot.countrySearch, true);
  } else if (route.view === "country-overview" && snapshot.countryChoice) set("#country-overview-select", snapshot.countryChoice);
}

export function restoreNavigationPosition(route: ResearchHistoryRoute, snapshot?: NavigationSnapshot): void {
  const root = document.querySelector<HTMLElement>(panelSelector(route));
  const focus = snapshot?.focus;
  root?.querySelectorAll<HTMLDetailsElement>("details").forEach((node, index) => { node.open = snapshot?.details.includes(index) ?? node.open; });
  const containers = root?.querySelectorAll<HTMLElement>(SCROLL_CONTAINERS);
  snapshot?.innerScroll.forEach(([index, top, left]) => { const node = containers?.[index]; if (node) { node.scrollTop = top; node.scrollLeft = left; } });
  const target = focus ? root?.querySelectorAll<HTMLElement>(focusSelector(focus))[focus.occurrence ?? 0] : null;
  const heading = route.view === "time" ? "query-zone-title" : route.view === "profile"
    ? route.clade ? "profile-workspace-title" : "profile-clade-search"
    : route.view === "country" ? "country-evidence-workspace-title" : "country-overview-workspace-title";
  (target ?? document.getElementById(heading))?.focus({ preventScroll: true });
  if (typeof window.scrollTo === "function") window.scrollTo({ top: snapshot?.scroll ?? 0, behavior: "instant" });
}
function focusSelector(focus: Focus): string {
  return `${focus.mode ? `table[data-result-mode="${focus.mode}"] ` : ""}[${focus.attribute}="${focus.value}"]${focus.country ? `[data-country-evidence="${focus.country}"]` : ""}`;
}
