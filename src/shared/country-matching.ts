import type { PresenceMode } from "./types";

/** Zero keeps every selected country; positive thresholds use whole-dataset counts in the active sample scope. */
export function matchingCountryCodes(
  selectedCodes: readonly string[], counts: ReadonlyMap<string, number>, minimum: number,
): string[] {
  const threshold = Math.max(0, Number.isFinite(minimum) ? Math.round(minimum) : 0);
  if (threshold === 0) return [...selectedCodes];
  return selectedCodes.filter(code => (counts.get(code) ?? 0) >= threshold);
}

export function hasCountryMatch(
  counts: ReadonlyMap<string, number>, matchingCodes: readonly string[], presence: PresenceMode,
): boolean {
  if (matchingCodes.length === 0) return false;
  return presence === "all"
    ? matchingCodes.every(code => (counts.get(code) ?? 0) > 0)
    : matchingCodes.some(code => (counts.get(code) ?? 0) > 0);
}
