import { normalizeHistoryState } from "./history-state";

export type ResultDetailScope = { mode: "formed" | "crossing"; countries: string[]; parentId?: string };
export type ResearchHistoryRoute =
  | { view: "time" }
  | { view: "profile"; clade: string | null; detail?: ResultDetailScope }
  | { view: "country-overview"; country: string | null; countries?: string[] }
  | { view: "country"; country: string | null; anchorId: string | null; parentView?: "profile" | "country-overview"; countries?: string[] };
export type HistoryMode = "push" | "replace" | "none";

export function safeClade(value: unknown): string | null {
  return typeof value === "string" && /^[a-z0-9][a-z0-9_.+-]{0,99}$/i.test(value) ? value : null;
}
function countryScope(value: unknown): string[] | undefined {
  const codes = typeof value === "string" ? value.slice(0, 1200).split(",") : Array.isArray(value) ? value.slice(0, 250) : [];
  const valid = [...new Set(codes.filter((code): code is string => typeof code === "string" && /^[A-Z]{3}$/.test(code)))].sort();
  return valid.length ? valid : undefined;
}
export function parseHistoryRoute(value: unknown): ResearchHistoryRoute | null {
  if (!value || typeof value !== "object") return null;
  const state = normalizeHistoryState(value);
  if (state.ynodusView === "time") return { view: "time" };
  if (state.ynodusView === "profile") {
    const countries = countryScope(state.ynodusScope);
    const mode = state.ynodusDetail;
    const parentId = safeClade(state.ynodusDetailParent);
    // Incomplete detail links fail closed to the search, never to an unfiltered profile.
    if (mode != null && (!countries || !safeClade(state.ynodusClade)
      || (mode !== "formed" && mode !== "crossing") || (mode === "crossing" && !parentId))) return { view: "time" };
    return { view: "profile", clade: safeClade(state.ynodusClade),
      ...(mode === "formed" || mode === "crossing" ? { detail: { mode, countries: countries!, ...(parentId ? { parentId } : {}) } } : {}) };
  }
  if (state.ynodusView === "country-overview") return {
    view: "country-overview", country: typeof state.ynodusCountry === "string" && /^[A-Z]{3}$/.test(state.ynodusCountry) ? state.ynodusCountry : null,
    countries: countryScope(state.ynodusScope),
  };
  if (state.ynodusView === "country") return {
    view: "country", country: typeof state.ynodusCountry === "string" && /^[A-Z]{3}$/.test(state.ynodusCountry) ? state.ynodusCountry : null,
    anchorId: safeClade(state.ynodusAnchor),
    parentView: state.ynodusParentView === "country-overview" ? "country-overview" : "profile",
    countries: countryScope(state.ynodusScope),
  };
  return null;
}
export function routeFromUrl(url: URL): ResearchHistoryRoute {
  return parseHistoryRoute({ ynodusView: url.searchParams.get("view"),
    ynodusClade: url.searchParams.get("clade"), ynodusCountry: url.searchParams.get("country"),
    ynodusAnchor: url.searchParams.get("clade"), ynodusScope: url.searchParams.get("scope"),
    ynodusDetail: url.searchParams.get("detail"), ynodusDetailParent: url.searchParams.get("edge"),
    ynodusParentView: url.searchParams.get("from") === "overview" ? "country-overview" : "profile" }) ?? { view: "time" };
}
export function sameHistoryRoute(left: ResearchHistoryRoute, right: ResearchHistoryRoute): boolean {
  if (left.view !== right.view) return false;
  if (left.view === "time" || right.view === "time") return true;
  if (left.view === "profile" && right.view === "profile") return left.clade === right.clade
    && left.detail?.mode === right.detail?.mode && left.detail?.parentId === right.detail?.parentId
    && (left.detail?.countries ?? []).join() === (right.detail?.countries ?? []).join();
  if (left.view === "country-overview" && right.view === "country-overview") return left.country === right.country
    && (left.countries ?? [left.country]).join() === (right.countries ?? [right.country]).join();
  return left.view === "country" && right.view === "country"
    && left.country === right.country && left.anchorId === right.anchorId
    && (left.parentView ?? "profile") === (right.parentView ?? "profile")
    && (left.countries ?? [left.country]).join() === (right.countries ?? [right.country]).join();
}
export function writeRouteHistory(route: ResearchHistoryRoute, mode: Exclude<HistoryMode, "none">): void {
  const next: Record<string, unknown> = { ...normalizeHistoryState(history.state), ynodusView: route.view };
  delete next.ynodusClade; delete next.ynodusCountry; delete next.ynodusAnchor; delete next.ynodusParentView;
  delete next.ynodusScope;
  delete next.ynodusDetail; delete next.ynodusDetailParent;
  if (route.view === "profile" && route.detail) {
    next.ynodusDetail = route.detail.mode; next.ynodusScope = route.detail.countries;
    next.ynodusDetailParent = route.detail.parentId;
  }
  if (route.view === "profile" && route.clade) next.ynodusClade = route.clade;
  if (route.view === "country-overview") { next.ynodusCountry = route.country; next.ynodusScope = route.countries; }
  if (route.view === "country") {
    next.ynodusCountry = route.country; next.ynodusAnchor = route.anchorId;
    next.ynodusParentView = route.parentView ?? "profile";
    next.ynodusScope = route.countries;
  }
  let url: URL | undefined;
  if (typeof location !== "undefined") {
    url = new URL(location.href);
    url.searchParams.set("view", route.view);
    url.searchParams.delete("clade"); url.searchParams.delete("country"); url.searchParams.delete("from");
    url.searchParams.delete("scope");
    url.searchParams.delete("detail"); url.searchParams.delete("edge");
    if (route.view === "profile" && route.detail) {
      url.searchParams.set("detail", route.detail.mode);
      url.searchParams.set("scope", route.detail.countries.join(","));
      if (route.detail.parentId) url.searchParams.set("edge", route.detail.parentId);
    }
    const clade = route.view === "profile" ? route.clade : route.view === "country" ? route.anchorId : null;
    if (clade) url.searchParams.set("clade", clade);
    if ((route.view === "country" || route.view === "country-overview") && route.country) url.searchParams.set("country", route.country);
    if (route.view === "country" && route.parentView === "country-overview") url.searchParams.set("from", "overview");
    if (route.view === "country" && route.countries?.length) url.searchParams.set("scope", route.countries.join(","));
    if (route.view === "country-overview" && route.countries?.length) url.searchParams.set("scope", route.countries.join(","));
  }
  if (mode === "replace") history.replaceState(next, "", url);
  else history.pushState(next, "", url);
}
