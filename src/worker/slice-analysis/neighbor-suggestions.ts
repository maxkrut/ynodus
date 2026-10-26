import type { NeighborSuggestions, PresenceMode } from "../types";
import type { DensityEvidenceRow } from "./evidence";
import { hasCountryMatch } from "../../shared/country-matching";

/** Nearest source dates whose own windows contain an event matching the dataset rule. */
export function findResultNeighbors(
  groups: ReadonlyMap<string, DensityEvidenceRow>, required: string[],
  presence: PresenceMode, target: number, window: number,
): NeighborSuggestions {
  const rows = [...groups.values()].sort((a, b) => a.node.formed - b.node.formed);
  const dates = [...new Set(rows.map(row => row.node.formed))];
  const result: NeighborSuggestions = { older: null, younger: null };
  if (!required.length) return result;
  // Each connected equal-age event has its supported root here. Testing roots
  // suffices for existence even when a narrower member lacks a required country.
  const matchingDates = rows.filter(row => hasCountryMatch(row.countryCounts, required, presence))
    .map(row => row.node.formed);
  let left = 0;
  for (const date of dates) {
    while (left < matchingDates.length && matchingDates[left] < date - window) left++;
    if (left === matchingDates.length) break;
    if (matchingDates[left] > date + window) continue;
    if (date < target) result.younger = date;
    else if (date > target) { result.older = date; break; }
  }
  return result;
}
