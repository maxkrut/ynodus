import type { PresenceMode, TreeIndexSummary, SliceMode } from "./types";

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
 * requires all selected countries at zero, or temporal-pool qualifiers above zero.
 */
export function densityScopeIdentity(
  index: DensityIndexIdentity,
  selectedCodes: readonly string[],
  presenceMode: PresenceMode,
  anchorId: string | null,
  minSamples = 0,
  target = 0,
  maxDeltaYbp = 0,
  sliceMode: SliceMode = "formed",
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
    ...(presenceMode === "all" ? [sliceMode, target, sliceMode === "formed" ? maxDeltaYbp : 0] : []),
  ].join("|");
}
