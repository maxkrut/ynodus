const fields = ["View", "Clade", "Country", "Anchor", "ParentView", "Scope", "Detail", "DetailParent", "Navigation"];
const views = new Set(["time", "profile", "country", "country-overview"]);
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value)
  ? value as Record<string, unknown> : {};

/** Migrate one unambiguous version-1 navigation envelope, independent of its former namespace. */
export function normalizeHistoryState(value: unknown): Record<string, unknown> {
  const state = record(value);
  if (fields.some(field => Object.hasOwn(state, `ynodus${field}`))) return { ...state };
  const prefixes = Object.keys(state).filter(key => {
    if (!/^[a-z][a-z0-9_]{0,39}Navigation$/i.test(key)) return false;
    const prefix = key.slice(0, -"Navigation".length), entry = record(state[key]);
    const view = record(entry.route).view;
    return entry.version === 1 && typeof entry.owner === "string" && /^[a-z0-9-]{8,80}$/i.test(entry.owner)
      && Number.isSafeInteger(entry.index) && Number(entry.index) >= 0
      && typeof view === "string" && views.has(view) && state[`${prefix}View`] === view;
  }).map(key => key.slice(0, -"Navigation".length));
  if (prefixes.length !== 1) return { ...state };
  const prefix = prefixes[0], next = { ...state };
  for (const field of fields) {
    const key = `${prefix}${field}`;
    if (Object.hasOwn(state, key)) { next[`ynodus${field}`] = state[key]; delete next[key]; }
  }
  return next;
}
