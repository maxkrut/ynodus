import type { PresenceMode, ResultRow } from "../types";
import type { SampleEvidence } from "./evidence";
import { hasCountryMatch, matchingCountryCodes } from "../../shared/country-matching";

/** Count each aggregate sample once across all time candidates, before country matching. */
export function countriesForTimeEvidence(
  selectedCodes: string[], samples: SampleEvidence[], presence: PresenceMode, minimum: number,
): string[] {
  if (presence === "any") return selectedCodes;
  const counts = new Map<string, number>();
  for (const sample of samples) if (sample.resultKeys.length) {
    counts.set(sample.country, (counts.get(sample.country) ?? 0) + sample.count);
  }
  return matchingCountryCodes(selectedCodes, counts, minimum);
}

/** Match common branches of eligible countries; retain other selected countries as context. */
export function filterCountryMinimum(
  rows: ResultRow[],
  samples: SampleEvidence[],
  matchingCodes: string[],
  presence: PresenceMode,
  keyOf: (row: ResultRow) => string,
): { rows: ResultRow[]; sampleEvidence: SampleEvidence[] } {
  const matching = new Set(matchingCodes);
  const qualifiedKeys = new Set<string>();
  const qualifiedRows: ResultRow[] = [];
  for (const row of rows) {
    if (!hasCountryMatch(row.countryCounts, matchingCodes, presence)) continue;
    const belowMinimumCountryCounts = presence === "any" ? new Map<string, number>()
      : new Map([...row.countryCounts].filter(([code]) => !matching.has(code)));
    qualifiedKeys.add(keyOf(row));
    qualifiedRows.push(belowMinimumCountryCounts.size ? { ...row, belowMinimumCountryCounts } : row);
  }
  const sampleEvidence = samples.flatMap(sample => {
    const resultKeys = sample.resultKeys.filter(key => qualifiedKeys.has(key));
    return resultKeys.length ? [{ ...sample, resultKeys }] : [];
  });
  return { rows: qualifiedRows, sampleEvidence };
}
