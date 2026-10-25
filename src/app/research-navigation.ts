import { parseHistoryRoute, sameHistoryRoute, writeRouteHistory, type HistoryMode, type ResearchHistoryRoute } from "./research-history";
import { readNavigationSnapshot, restoreNavigationPosition, type NavigationSnapshot } from "./navigation-snapshot";
import { normalizeHistoryState } from "./history-state";
import type { ResearchView } from "../shared/types";
import type { TextKey } from "./i18n";

type Origin = { index: number; route: ResearchHistoryRoute };
type Workspace = { route: ResearchHistoryRoute; origin?: Origin; snapshot?: NavigationSnapshot };
type Entry = Workspace & { version: 1; owner: string; index: number; workspaces: Partial<Record<ResearchView, Workspace>> };
type Options = {
  initial: ResearchHistoryRoute;
  capture: () => NavigationSnapshot;
  apply: (snapshot: NavigationSnapshot) => void;
  inputs: (route: ResearchHistoryRoute, snapshot: NavigationSnapshot) => void;
  refresh: () => void;
  ready: () => boolean;
  restoreRoute: (route: ResearchHistoryRoute) => Promise<void>;
  restoreQuery?: () => Promise<void>;
  invalidate: () => void;
  dismiss: () => void;
  t: (key: TextKey) => string;
};
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
function readRoute(value: unknown): ResearchHistoryRoute | null {
  const route = object(value);
  return parseHistoryRoute({ ynodusView: route.view, ynodusClade: route.clade,
    ynodusCountry: route.country, ynodusAnchor: route.anchorId, ynodusParentView: route.parentView,
    ynodusScope: object(route.detail).countries ?? route.countries,
    ynodusDetail: object(route.detail).mode, ynodusDetailParent: object(route.detail).parentId });
}
function readEntry(value: unknown, route: ResearchHistoryRoute): Entry | null {
  const raw = object(normalizeHistoryState(value).ynodusNavigation);
  if (raw.version !== 1 || !/^[a-z0-9-]{8,80}$/i.test(String(raw.owner)) || !Number.isSafeInteger(raw.index) || Number(raw.index) < 0) return null;
  const current = readRoute(raw.route);
  if (!current || !sameHistoryRoute(current, route)) return null;
  const workspace = (value: unknown): Workspace | undefined => {
    const raw = object(value), route = readRoute(raw.route), origin = object(raw.origin), originRoute = readRoute(origin.route);
    if (!route) return;
    return { route, snapshot: readNavigationSnapshot(raw.snapshot), origin: originRoute && Number.isSafeInteger(origin.index)
      && Number(origin.index) >= -1 && Number(origin.index) < entryIndex
      ? { index: Number(origin.index), route: originRoute } : undefined };
  };
  const entryIndex = Number(raw.index);
  const currentWorkspace = workspace(raw)!;
  const workspaces: Entry["workspaces"] = {};
  for (const view of ["time", "profile", "country", "country-overview"] as const) {
    const saved = workspace(object(raw.workspaces)[view]);
    if (saved && (saved.route.view === view || (saved.route.view === "country" && (saved.route.parentView ?? "profile") === view))) workspaces[view] = saved;
  }
  return { ...currentWorkspace, version: 1, owner: String(raw.owner), index: Number(raw.index), workspaces };
}
function fallback(route: ResearchHistoryRoute): ResearchHistoryRoute {
  if (route.view === "profile" && route.detail) return { view: "time" };
  if (route.view === "country") return route.parentView === "country-overview"
    ? { view: "country-overview", country: route.country } : { view: "profile", clade: route.anchorId };
  return route.view === "country-overview" ? { view: "country-overview", country: null } : { view: "profile", clade: null };
}

/** Contextual returns use a known earlier entry; tab switches keep each workspace's own origin. */
export function createResearchNavigation(options: Options) {
  let entry: Entry = typeof history !== "undefined" ? readEntry(history.state, options.initial) ?? fresh(options.initial) : fresh(options.initial);
  let generation = 0;
  let pending = true;
  let restoring = false;
  const visited = new Map<string, NavigationSnapshot>();
  const routes = new Map<string, ResearchHistoryRoute>();
  const entryKey = () => `${entry.owner}:${entry.index}`;
  const enabled = typeof window !== "undefined" && typeof history !== "undefined";
  function fresh(route: ResearchHistoryRoute): Entry {
    const owner = typeof crypto.randomUUID === "function" ? crypto.randomUUID()
      : [...crypto.getRandomValues(new Uint32Array(4))].map(value => value.toString(16).padStart(8, "0")).join("-");
    return { version: 1, owner, index: 0, route, workspaces: {} };
  }
  function persist() {
    if (enabled) history.replaceState({ ...normalizeHistoryState(history.state), ynodusNavigation: entry }, "");
  }
  function remember() {
    entry.snapshot = options.capture();
    visited.set(entryKey(), entry.snapshot);
    routes.set(entryKey(), entry.route);
    const workspace = { route: entry.route, origin: entry.origin, snapshot: entry.snapshot };
    if (!(entry.route.view === "profile" && entry.route.detail)) entry.workspaces[entry.route.view] = workspace;
    if (entry.route.view === "country") entry.workspaces[entry.route.parentView ?? "profile"] = workspace;
  }
  function save() { remember(); persist(); }
  if (enabled) {
    writeRouteHistory(options.initial, "replace"); persist();
    history.scrollRestoration = "manual";
    window.addEventListener("pagehide", save);
    window.addEventListener("popstate", async event => {
      const route = parseHistoryRoute(event.state);
      if (!route) return;
      const token = ++generation;
      // popstate fires after history moved: retain the departed UI in memory for Forward.
      remember();
      const departed = entry;
      options.dismiss(); options.invalidate();
      entry = readEntry(event.state, route) ?? fresh(route);
      if (entry.owner === departed.owner) {
        // Tabs retain their latest screen even when chronological history goes back.
        entry.workspaces = { ...entry.workspaces, ...departed.workspaces };
        for (const view of ["time", "profile", "country", "country-overview"] as const) {
          const saved = entry.workspaces[view];
          if (saved?.origin && saved.origin.index >= entry.index) {
            entry.workspaces[view] = { ...saved, origin: { ...saved.origin, index: -1 } };
          }
        }
      }
      routes.set(entryKey(), route);
      entry.snapshot = visited.get(entryKey()) ?? entry.snapshot;
      persist();
      pending = true; restoring = true;
      await options.restoreQuery?.();
      if (token !== generation) return;
      await options.restoreRoute(route);
      if (token !== generation) return;
      restoring = false;
      flush();
    });
  }
  function commit(target: Workspace, mode: "push" | "replace") {
    generation += 1;
    restoring = false;
    const nextIndex = mode === "push" ? entry.index + 1 : entry.index;
    for (const key of visited.keys()) if (key.startsWith(`${entry.owner}:`) && Number(key.split(":")[1]) >= nextIndex) { visited.delete(key); routes.delete(key); }
    const origin = target.origin;
    const knownOrigin = origin && routes.get(`${entry.owner}:${origin.index}`);
    // A saved tab can outlive its original history branch. Keep its named return,
    // but don't jump to a reused index containing an unrelated screen.
    if (origin && (origin.index >= nextIndex || (knownOrigin && !sameHistoryRoute(knownOrigin, origin.route)))) {
      target = { ...target, origin: { ...origin, index: -1 } };
    }
    entry = { ...entry, ...target, index: nextIndex, workspaces: { ...entry.workspaces } };
    // Spreading a target without these fields must not retain the departed workspace's return.
    entry.origin = target.origin; entry.snapshot = target.snapshot;
    pending = true;
    if (enabled) { writeRouteHistory(target.route, mode); persist(); }
  }
  function navigate(route: ResearchHistoryRoute, mode: HistoryMode) {
    if (mode === "none") return;
    if (sameHistoryRoute(entry.route, route)) return;
    save();
    commit({ route, origin: { index: entry.index, route: entry.route } }, mode);
  }
  function revise(route: ResearchHistoryRoute) {
    save(); commit({ route, origin: entry.origin, snapshot: entry.snapshot }, "replace"); pending = false;
  }
  function workspace(view: ResearchView) {
    save();
    const target = entry.workspaces[view] ?? { route: view === "profile" ? { view, clade: null }
      : view === "country-overview" ? { view, country: null } : { view: "time" } };
    if (sameHistoryRoute(entry.route, target.route)) return;
    options.invalidate(); options.dismiss();
    commit(target, "push");
    void restore(target.route);
  }
  function back() {
    const origin = entry.origin;
    if (enabled && origin && origin.index >= 0 && origin.index < entry.index && typeof history.go === "function") {
      save(); generation += 1; options.invalidate(); history.go(origin.index - entry.index); return;
    }
    const route = origin?.route ?? fallback(entry.route);
    const remembered = origin && Object.values(entry.workspaces).find(saved => sameHistoryRoute(saved.route, route));
    const snapshot = remembered?.snapshot ?? options.capture();
    if (!remembered?.snapshot) {
      snapshot.scroll = 0; snapshot.focus = { attribute: "id", value: route.view === "profile" ? "profile-clade-search" : "country-overview-select" };
    }
    options.invalidate(); options.dismiss();
    save(); commit({ route, snapshot, origin: remembered?.origin }, "push");
    void restore(route);
  }
  async function restore(route: ResearchHistoryRoute) {
    const token = generation;
    restoring = true;
    await options.restoreRoute(route);
    if (token !== generation) return;
    restoring = false; flush();
  }
  function label(route: ResearchHistoryRoute) {
    if (route.view === "time") return options.t("returnToTimeResults");
    if (route.view === "profile") return route.clade ? options.t("returnToNamedProfile").replace("{clade}", route.clade) : options.t("returnToCladeSearch");
    if (route.view === "country-overview") return route.country ? options.t("returnToNamedCountry").replace("{country}", route.country) : options.t("returnToCountryChoice");
    return options.t("returnToCountryBranch").replace("{country}", route.countries?.join(" + ") ?? route.country ?? "").replace("{clade}", route.anchorId ?? "");
  }
  function render() {
    const target = entry.origin?.route ?? fallback(entry.route);
    const hide = (entry.route.view === "profile" && !entry.route.clade) || (entry.route.view === "country-overview" && !entry.route.country);
    document.querySelectorAll?.<HTMLElement>("[data-research-back]").forEach(button => {
      button.hidden = hide;
      const span = button.querySelector("span:last-child");
      if (span) span.textContent = label(target);
    });
  }
  function flush() {
    if (!pending || restoring || !options.ready()) return;
    pending = false;
    const token = generation, route = entry.route, snapshot = entry.snapshot;
    if (snapshot) {
      options.apply(snapshot); options.refresh(); options.inputs(route, snapshot);
    }
    queueMicrotask(() => { if (token === generation) restoreNavigationPosition(route, snapshot); });
  }
  return { navigate, revise, workspace, back, render, flush, remember: save, keepPosition: () => { pending = false; } };
}
