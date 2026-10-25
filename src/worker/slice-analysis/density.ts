import { densityIntervals, densityIntervalIndex } from "../../shared/density-intervals";
import { sliderRangeMax } from "../../shared/time-slider";
import { densityScopeIdentity, type DensityBin } from "../../shared/density-identity";
import { hasCountryMatch, matchingCountryCodes } from "../../shared/country-matching";
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
  const rows = intervalRows(index, groups, countries, presence, minimum, anchor, bins);
  writeDensityRows(key, rows);
  return { densityKey: key, densityRows: rows };
}

function intervalRows(index: TreeIndex, groups: Map<string, DensityEvidenceRow>, countries: string[],
  presence: PresenceMode, minimum: number, anchor: string | null, bins: readonly DensityBin[]): DensityRow[] {
  const bucketById = new Map([...groups.values()].map(row => [row.node.id, densityIntervalIndex(row.node.formed, bins)]));
  const pools = bins.map(() => new Map<string, number>());
  if (presence === "all" && minimum > 0) {
    // A sample can support many nested candidates, including inverted source ages.
    // Count it only once in each touched interval, without summing descendant totals.
    for (const country of countries) for (const sample of index.samplesByCountry.get(country) ?? []) {
      const start = anchor ? sample.path.findIndex(node => node.id === anchor) : 0;
      if (start < 0) continue;
      const touched = new Set<number>();
      for (let i = start; i < sample.path.length; i++) {
        const bucket = bucketById.get(sample.path[i].id);
        if (bucket !== undefined) touched.add(bucket);
      }
      for (const bucket of touched) pools[bucket].set(country, (pools[bucket].get(country) ?? 0) + sample.count);
    }
  }
  const required = pools.map(pool => presence === "any" ? countries : matchingCountryCodes(countries, pool, minimum));
  const eligibility = new Map<string, boolean>();
  const qualifies = (row: DensityEvidenceRow): boolean => {
    const path: DensityEvidenceRow[] = [];
    let current = row;
    while (!eligibility.has(current.node.id)) {
      path.push(current);
      const parent = current.parentId ? groups.get(current.parentId) : undefined;
      if (!parent || parent.node.formed !== current.node.formed) {
        eligibility.set(current.node.id, hasCountryMatch(current.countryCounts, required[bucketById.get(current.node.id)!], presence));
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
      ...(presence === "all" ? { participatingCountries: required[bucketById.get(node.id)!] } : {}) }));
}
