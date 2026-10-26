import type { PresenceMode, TreeIndexSummary } from "./types";

export type DensityBin = { older: number; younger: number };

type DensityIndexIdentity = Pick<
  TreeIndexSummary,
  | "sampleScope"
  | "version"
  | "officialVersion"
  | "computedDate"
  | "generatedAt"
  | "manifestSampleCount"
  | "sampleCount"
  | "nodes"
>;

/**
 * All-branches context is independent of the time query. Common-branches context
 * requires all selected countries at zero, or the active sample scope across the dataset above zero.
 */
export function densityScopeIdentity(
  index: DensityIndexIdentity,
  selectedCodes: readonly string[],
  presenceMode: PresenceMode,
  anchorId: string | null,
  minSamples = 0,
  intervals: readonly DensityBin[] = [],
): string {
  return [
    index.sampleScope ?? "all",
    index.version,
    index.officialVersion,
    index.computedDate,
    index.generatedAt,
    index.manifestSampleCount ?? "",
    index.sampleCount,
    index.nodes,
    presenceMode,
    anchorId ?? "",
    [...selectedCodes].sort().join(","),
    presenceMode === "any" ? 1 : Math.max(0, Math.round(minSamples)),
    ...(presenceMode === "all" && minSamples > 0 ? [intervals.map(bin => `${bin.older}:${bin.younger}`).join(",")] : []),
  ].join("|");
}
