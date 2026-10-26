import { densityIntervals } from "../../shared/density-intervals";
import { sliderRangeMax } from "../../shared/time-slider";
import { densityScopeIdentity, type DensityBin } from "../../shared/density-identity";
import { hasCountryMatch } from "../../shared/country-matching";
import { countriesForDataset } from "./country-minimum";
import type { DensityRow, PresenceMode, TreeIndex } from "../types";
import { collectEvidenceRows, type DensityEvidenceRow } from "./evidence";
import { readDensityGroups, writeDensityGroups, readDensityRows, writeDensityRows } from "./density-cache";

export function collectIntervalDensity(index: TreeIndex, countries: string[], presence: PresenceMode,
  minimum: number, anchor: string | null, requestedBins?: readonly DensityBin[]) {
  const bins = requestedBins ?? densityIntervals(300, sliderRangeMax(true), { fullRange: true, maxFormedYbp: index.maxFormedYbp });
  const key = densityScopeIdentity(index, countries, presence, anchor, minimum, bins);
  if (!bins.length || bins.length > 8192) return { densityKey: `invalid-grid|${key}`, densityRows: [] };
  const cached = readDensityRows(key);
  if (cached) return { densityKey: key, densityRows: cached };
  const rawKey = densityScopeIdentity(index, countries, "any", anchor);
  let groups = readDensityGroups(rawKey);
  if (!groups) {
    groups = collectEvidenceRows(index, countries, anchor, "formed", 0, 0, true).densityGroups!;
    writeDensityGroups(rawKey, groups);
  }
  const rows = matchingRows(groups, countriesForDataset(index, countries, presence, minimum), presence);
  writeDensityRows(key, rows);
  return { densityKey: key, densityRows: rows };
}

function matchingRows(groups: Map<string, DensityEvidenceRow>, required: string[], presence: PresenceMode): DensityRow[] {
  const eligibility = new Map<string, boolean>();
  const qualifies = (row: DensityEvidenceRow): boolean => {
    const path: DensityEvidenceRow[] = [];
    let current = row;
    while (!eligibility.has(current.node.id)) {
      path.push(current);
      const parent = current.parentId ? groups.get(current.parentId) : undefined;
      if (!parent || parent.node.formed !== current.node.formed) {
        eligibility.set(current.node.id, hasCountryMatch(current.countryCounts, required, presence));
        break;
      }
      current = parent;
    }
    const match = eligibility.get(current.node.id)!;
    for (const member of path) eligibility.set(member.node.id, match);
    return match;
  };
  return [...groups.values()].filter(qualifies).sort((a, b) => b.node.formed - a.node.formed
    || b.total - a.total || a.node.id.localeCompare(b.node.id))
    .map(({ node, parentId, parentMacroGroup, total }) => ({ node, parentId, parentMacroGroup, total,
      ...(presence === "all" ? { participatingCountries: required } : {}) }));
}
