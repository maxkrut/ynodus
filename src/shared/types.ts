export type SampleScope = "all" | "modern" | "ancient";
export type AncientEvidence = { ancientTotal?: number; ancientCountryCounts?: Map<string, number> };

export type Locale = "en" | "ru";

export type LocalizedText = string | { en: string; ru?: string };

export type TreeNodeRef = {
  id: string;
  project: string;
  /** Display group from the closest named ancestor; project retains source metadata. */
  macroGroup?: string;
  formed: number;
  /** False when the source has no formation estimate; formed is then the non-date sentinel 0. */
  formedKnown: boolean;
};

export type TreeIndexSummary = {
  format: "ynodus/hras-index-v3";
  formatVersion: 3;
  source: string;
  sourceUrl: string;
  sourceManifestUrl: string;
  licenseNotice: string;
  sourceLicenses: {
    applicationCode: string;
    referenceTree: string;
    hrasSourceCode: string;
  };
  version: string;
  officialVersion: string;
  referenceRelease?: { date: string; sourceUrl: string } | null;
  computedDate: string;
  generatedAt: string;
  manifestSampleCount: number | null;
  nodes: number;
  maxFormedYbp: number;
  sampleCount: number;
  sampleScope?: SampleScope;
  snapshotSampleCount?: number;
  ancientSampleCount?: number;
  countries: Map<string, number>;
};

type FormedGroupMember = {
  node: TreeNodeRef;
  path: TreeNodeRef[];
};

/**
 * One dated event inside a Formed branch result. Members share one exact
 * source formed estimate; event totals are nested evidence and must not be
 * added together.
 */
type FormedBranchEvent = AncientEvidence & {
  node: TreeNodeRef;
  path: TreeNodeRef[];
  formedMembers: FormedGroupMember[];
  total: number;
  delta: number;
  countryCounts: Map<string, number>;
  /** Canonical event above this event inside the displayed branch. */
  parentEventId: string | null;
  /** Real immediate source parent that connects this event to its parent event. */
  viaParentId: string | null;
};

export type ResultRow = AncientEvidence & {
  /**
   * Root/primary identity of the canonical result. For Formed this is the
   * upper supported event of one connected dated branch; Crossing keeps the
   * real parent endpoint here.
   */
  node: TreeNodeRef;
  /** Primary real source ancestry in root -> result-endpoint order. */
  path: TreeNodeRef[];
  /**
   * Canonical Formed-group members in source ancestry order. A singleton is
   * represented explicitly; Crossing results do not carry this field.
   */
  formedMembers?: FormedGroupMember[];
  /**
   * Supported dated events connected to the upper Formed match by real,
   * immediate source edges. The first event is the evidence-carrying result;
   * later events are explanatory nested detail.
   */
  formedEvents?: FormedBranchEvent[];
  /** Oldest and youngest source formed estimates represented by the branch. */
  formedSpan?: { olderYbp: number; youngerYbp: number };
  /** Closest and farthest absolute distance from the active target. */
  deltaRange?: { minYbp: number; maxYbp: number };
  total: number;
  delta: number;
  countryCounts: Map<string, number>;
  sliceRelation?: SliceRelation;
  /** Below the temporal-pool country minimum: local counts retained, flags shown faded. */
  belowMinimumCountryCounts?: Map<string, number>;
  /** Child endpoint when a crossing-mode result represents a real parent -> child edge. */
  crossingChild?: TreeNodeRef;
};

/** Target-slider density only; deliberately excludes per-result ancestry paths. */
export type DensityRow = {
  node: Pick<TreeNodeRef, "id" | "project" | "macroGroup" | "formed">;
  /** Real source parent used only to group connected same-date nodes in the context map. */
  parentId: string | null;
  total: number;
};

export type SignatureRow = AncientEvidence & {
  node: TreeNodeRef;
  total: number;
  countryCounts: Map<string, number>;
};

/** Aggregated publisher-recorded evidence for one supported immediate branch. */
export type EvidenceBranch = AncientEvidence & {
  node: TreeNodeRef;
  total: number;
  countryCounts: Map<string, number>;
};

/** One fully materialized supported node inside a selected profile subtree. */
export type EvidenceTreeNode = EvidenceBranch & {
  directTotal: number;
  children: EvidenceTreeNode[];
};

/**
 * Evidence-first profile derived from the local HRAS/YSEQ snapshot. Counts are
 * sample evidence in the publisher dataset, never population frequencies or
 * historical-geography estimates.
 */
export type SubcladeProfile = AncientEvidence & {
  node: TreeNodeRef;
  path: TreeNodeRef[];
  parent: TreeNodeRef | null;
  total: number;
  countryCounts: Map<string, number>;
  directTotal: number;
  directCountryCounts: Map<string, number>;
  immediateBranches: EvidenceBranch[];
  evidenceTree: EvidenceTreeNode;
  supportedDescendantCount: number;
  datedDescendantCount: number;
};

export type CountryAssignment = AncientEvidence & {
  node: TreeNodeRef;
  total: number;
};

/**
 * One-country evidence partition inside a named local-snapshot branch. Direct
 * evidence and immediateBranches form an additive partition at this one level;
 * deeper assignments are a separate nested view and must not be added again.
 */
export type CountryEvidence = AncientEvidence & {
  country: string;
  anchor: TreeNodeRef;
  path: TreeNodeRef[];
  total: number;
  directTotal: number;
  immediateBranches: EvidenceBranch[];
  deepestAssignments: CountryAssignment[];
};

/** A disjoint partition of one country's terminal source-record assignments. */
export type CountryOverviewGroup = AncientEvidence & {
  /** Legacy key for the display macrogroup; assignment.node.project remains original. */
  project: string;
  total: number;
  assignments: CountryAssignment[];
};

/** Whole-snapshot overview for one publisher-recorded country code. */
export type CountryOverview = AncientEvidence & {
  country: string;
  /** Independent comparison scope; never the time-query country selection. */
  countries?: string[];
  countryCounts?: Map<string, number>;
  total: number;
  groups: CountryOverviewGroup[];
  assignments: CountryAssignment[];
  /** Real-source forest supported by the union of the selected country records. */
  roots: EvidenceTreeNode[];
};

export type PresenceMode = "any" | "all";
export type SliceMode = "formed" | "crossing";
type SliceRelation = "formed-in-slice" | "crossing-through";
export type ResearchView = "time" | "profile" | "country" | "country-overview";
export type TableSortKey = "subclade" | "formed" | "delta" | "total";
export type SortDirection = "asc" | "desc";

type PresetGuide = {
  period?: LocalizedText;
  region: LocalizedText;
  selection: LocalizedText;
  sources: { title: string; url: string }[];
};

export type CountryPreset = {
  key: string;
  label: LocalizedText;
  category: LocalizedText;
  countries: string[];
  guide?: PresetGuide;
  /**
   * A country-code proxy is only a UI shortcut over publisher-recorded country
   * codes. It is not an archaeological, ethnic, linguistic, or geographic model.
   */
  kind?: "regional" | "country-code-proxy";
};

export type NeighborSuggestions = {
  older: number | null;
  younger: number | null;
};

export type AnalysisResult = {
  /** Primary branch/edge rows for the active mode after presence and min-sample filtering. */
  rows: ResultRow[];
  /** Compact target-slider distribution for the current evidence scope. */
  /** Null only when the caller already holds the matching densityKey payload. */
  densityRows: DensityRow[] | null;
  /** Stable identity of the evidence-scope density payload. */
  densityKey: string;
  /** Unique selected samples supporting at least one primary result row. */
  matchingSamples: number;
  /** Normalized result-row evidence threshold applied by the worker. */
  minSamples: number;
  /** No selected country has qualifying temporal-pool evidence. */
  countryMinimumNotMet?: boolean;
  /** Countries required by this result kind's temporal pool; all selected in Any mode. */
  participatingCountries: string[];
  suggestions: NeighborSuggestions | null;
};

export type TimeAnalysisResult = {
  /** Canonical results formed inside Target +/- Hit. Always calculated. */
  formed: AnalysisResult;
  /** Optional parent -> child edges crossing the exact Target instant. */
  crossing: AnalysisResult | null;
};
