import { compareRowsByTotalDeltaId } from "./slice-analysis/rows";
import {
  collectEvidenceRows,
  crossingEdgeKey,
  type DensityEvidenceRow,
  type SampleEvidence,
} from "./slice-analysis/evidence";
import {
  formedBranchKey,
  formedGroupKey,
  groupConnectedFormedBranches,
} from "./slice-analysis/formed-groups";
import { densityScopeIdentity, type DensityBin } from "../shared/density-identity";
import { collectIntervalDensity } from "./slice-analysis/density";
import { countriesForDataset, filterCountryMinimum } from "./slice-analysis/country-minimum";
import { readDensityGroups, writeDensityGroups, resetDensityCache } from "./slice-analysis/density-cache";
import { findResultNeighbors } from "./slice-analysis/neighbor-suggestions";
import type { TimeAnalysisResult } from "../shared/types";
import type {
  AnalysisResult,
  PresenceMode,
  ResultRow,
  SliceMode,
  TreeIndex,
} from "./types";

export { signatureOptionsForQuery } from "./slice-analysis/signature-options";

type SliceAnalysisInput = {
  target: number;
  selectedCountries: string[];
  presenceMode: PresenceMode;
  sliceMode: SliceMode;
  maxDeltaYbp: number;
  minSamples: number;
  anchorId: string | null;
  scopeAllCountries: boolean;
  includeSuggestions?: boolean;
  /** Allows a client retaining this exact density scope to avoid a repeat transfer. */
  knownDensityKey?: string | null;
  densityIntervals?: readonly DensityBin[];
  /**
   * Crossing only: omit edges whose parent or child is already a Formed identity
   * or same-date member. Unset leaves the full classified Crossing set.
   */
  coveredFormedNodeIds?: readonly string[] | null;
};

type TimeMatchAnalysisInput = Omit<SliceAnalysisInput, "sliceMode" | "coveredFormedNodeIds"> & {
  includeCrossing: boolean;
};

/** Node ids already shown as Formed identities or same-date members of those branches. */
export function formedCoverageNodeIds(rows: readonly ResultRow[]): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    ids.add(row.node.id);
    for (const member of row.formedMembers ?? []) ids.add(member.node.id);
    for (const event of row.formedEvents ?? []) {
      ids.add(event.node.id);
      for (const member of event.formedMembers) ids.add(member.node.id);
    }
  }
  return [...ids];
}

export function crossingEdgeCoveredByFormed(
  row: ResultRow,
  coveredNodeIds: ReadonlySet<string>,
): boolean {
  const childId = row.crossingChild?.id;
  if (!childId) return false;
  return coveredNodeIds.has(row.node.id) || coveredNodeIds.has(childId);
}

export function resetSliceAnalysisCaches(): void {
  resetDensityCache();
}

export function collectRowsAtTarget(
  value: TreeIndex,
  input: SliceAnalysisInput,
): AnalysisResult {
  const {
    target,
    selectedCountries,
    presenceMode,
    sliceMode,
    maxDeltaYbp,
    minSamples: requestedMinSamples,
    anchorId,
    scopeAllCountries,
    includeSuggestions = true,
    knownDensityKey = null,
  } = input;
  const minSamples = normalizeMinSamples(requestedMinSamples);
  const pooledAnchorScope = Boolean(anchorId && scopeAllCountries && selectedCountries.length === 0);
  const selectedCodes = effectiveSelectedCodes(
    value,
    selectedCountries,
    anchorId,
    scopeAllCountries,
  );
  const effectivePresenceMode: PresenceMode = pooledAnchorScope ? "any" : presenceMode;
  const rawKey = densityScopeIdentity(value, selectedCodes, "any", anchorId);
  let densityGroups = readDensityGroups(rawKey);
  const evidenceRows = collectEvidenceRows(
    value,
    selectedCodes,
    anchorId,
    sliceMode,
    target,
    maxDeltaYbp,
    densityGroups === undefined,
  );
  if (!densityGroups) {
    densityGroups = evidenceRows.densityGroups ?? new Map<string, DensityEvidenceRow>();
    writeDensityGroups(rawKey, densityGroups);
  }
  const matchingCodes = countriesForDataset(value, selectedCodes, effectivePresenceMode, minSamples);
  const { densityKey, densityRows } = collectIntervalDensity(value, selectedCodes, effectivePresenceMode,
    minSamples, anchorId, input.densityIntervals);
  const qualifiedEvidence = filterCountryMinimum(evidenceRows.rows, evidenceRows.sampleEvidence,
    matchingCodes, effectivePresenceMode, resultRowKey);
  let eligibleRows = qualifiedEvidence.rows;
  const coveredFormedNodeIds = input.coveredFormedNodeIds;
  if (sliceMode === "crossing" && coveredFormedNodeIds && coveredFormedNodeIds.length > 0) {
    const covered = new Set(coveredFormedNodeIds);
    eligibleRows = eligibleRows.filter((row) => !crossingEdgeCoveredByFormed(row, covered));
  }
  const primaryEvidence = sliceMode === "formed"
    ? groupConnectedFormedBranches(eligibleRows, qualifiedEvidence.sampleEvidence)
    : { rows: eligibleRows, sampleEvidence: qualifiedEvidence.sampleEvidence };
  const sortedRows = primaryEvidence.rows.sort(compareRowsByTotalDeltaId);
  const primaryKeys = new Set(sortedRows.map(resultRowKey));
  const matchingSamples = countPrimaryEvidenceSamples(
    primaryEvidence.sampleEvidence,
    primaryKeys,
  );
  const suggestions = includeSuggestions && sliceMode === "formed" && sortedRows.length === 0
    ? findResultNeighbors(densityGroups, matchingCodes, effectivePresenceMode, target, maxDeltaYbp) : null;
  return {
    rows: sortedRows,
    densityRows: knownDensityKey === densityKey ? null : densityRows,
    densityKey,
    matchingSamples,
    minSamples,
    countryMinimumNotMet: effectivePresenceMode === "all"
      && selectedCodes.length > 0 && matchingCodes.length === 0,
    participatingCountries: matchingCodes,
    suggestions,
  };
}

/**
 * Formed is always primary. Optional Crossing is the same query's remaining
 * dated edges: those that cross Target and are not already represented by a
 * surviving Formed identity or same-date member.
 */
export function collectTimeMatchResults(
  value: TreeIndex,
  input: TimeMatchAnalysisInput,
): TimeAnalysisResult {
  const { includeCrossing, ...shared } = input;
  const formed = collectRowsAtTarget(value, {
    ...shared,
    sliceMode: "formed",
  });
  if (!includeCrossing) return { formed, crossing: null };
  return {
    formed,
    crossing: collectRowsAtTarget(value, {
      ...shared,
      sliceMode: "crossing",
      includeSuggestions: false,
      knownDensityKey: formed.densityKey,
      coveredFormedNodeIds: formedCoverageNodeIds(formed.rows),
    }),
  };
}

function effectiveSelectedCodes(
  value: TreeIndex,
  selectedCountries: string[],
  anchorId: string | null,
  scopeAllCountries: boolean,
): string[] {
  const requested = new Set(selectedCountries.filter((code) => value.countries.has(code)));
  if (requested.size > 0 || !anchorId || !scopeAllCountries) return [...requested].sort();
  return [...value.countries.keys()].sort();
}

function normalizeMinSamples(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function resultRowKey(row: ResultRow): string {
  if (row.crossingChild) return crossingEdgeKey(row.node.id, row.crossingChild.id);
  if (row.formedEvents) {
    return formedBranchKey(row.formedEvents.map((event) => formedGroupKey(
      event.formedMembers.map((member) => member.node.id),
      event.node.formed,
    )));
  }
  const memberIds = row.formedMembers?.map((member) => member.node.id) ?? [row.node.id];
  return formedGroupKey(memberIds, row.node.formed);
}

function countPrimaryEvidenceSamples(
  samples: SampleEvidence[],
  primaryKeys: Set<string>,
): number {
  if (primaryKeys.size === 0) return 0;
  let total = 0;

  for (const sample of samples) {
    if (sample.resultKeys.some((key) => primaryKeys.has(key))) total += sample.count;
  }
  return total;
}
