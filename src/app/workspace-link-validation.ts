import { routeFromUrl, writeRouteHistory } from "./research-history";

/** Invalid scoped links must not silently become a broader profile or comparison. */
export function correctWorkspaceLink(available?: ReadonlyMap<string, number>): boolean {
  const url = new URL(location.href), p = url.searchParams;
  let invalid = false;
  for (const [key, values, fallback] of [
    ["presence", ["all", "any"], "all"], ["crossing", ["0", "1"], "0"],
    ["samples", ["all", "modern", "ancient"], "all"],
  ] as const) {
    const value = p.get(key);
    if (value !== null && !(values as readonly string[]).includes(value)) { p.set(key, fallback); invalid = true; }
  }
  const route = routeFromUrl(url);
  const scope = route.view === "profile" ? route.detail?.countries : route.view !== "time" ? route.countries : undefined;
  const rawScope = p.get("scope")?.split(",");
  const country = route.view === "country" || route.view === "country-overview" ? route.country : null;
  const badScope = rawScope && (rawScope.length > 250 || rawScope.some(code => !/^[A-Z]{3}$/.test(code)));
  const missingCountry = available && ((country && !available.has(country)) || scope?.some(code => !available.has(code)));
  const badRoute = (p.has("view") && p.get("view") !== route.view)
    || (p.has("clade") && (route.view === "profile" ? !route.clade : route.view === "country" ? !route.anchorId : true))
    || (p.has("country") && !country) || badScope || !!missingCountry
    || (route.view === "country" && (!route.country || !route.anchorId))
    || (p.has("detail") && (route.view !== "profile" || !route.detail));
  if (invalid) history.replaceState(history.state, "", url);
  if (badRoute) writeRouteHistory(route.view === "country-overview"
    ? { view: "country-overview", country: null } : { view: "time" }, "replace");
  return invalid || !!badRoute;
}
