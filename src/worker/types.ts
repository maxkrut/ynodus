import type { SampleScope } from "../shared/types";
import type {
  AnalysisResult,
  CountryEvidence,
  CountryOverview,
  DensityRow,
  NeighborSuggestions,
  PresenceMode,
  ResultRow,
  SignatureRow,
  SliceMode,
  TreeIndexSummary,
  TreeNodeRef,
  SubcladeProfile,
  TimeAnalysisResult,
} from "../shared/types";

type HrasCompactNode = [
  project: number,
  parent: number,
  formed: number | null,
];

type HrasCompactSample = [node: number, country: number, count: number];

export type HrasIndex = {
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
  ancientCounts?: number[];
  treeOfficialVersion: string;
  referenceRelease?: { date: string; sourceUrl: string } | null;
  treeVersion: string;
  computedDate: string;
  hrasManifestSampleCount: number;
  generatedAt: string;
  nodeCount?: number;
  sampleCount?: number;
  projectIds: string[];
  countryCodes: string[];
  countryCounts: number[];
  nodeIds: string[];
  nodes: HrasCompactNode[];
  samples: HrasCompactSample[];
};

export type SampleRecord = {
  ancientCount?: number;
  country: string;
  count: number;
  path: TreeNodeRef[];
};

export type TreeIndex = {
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
  signatureIndex: Map<string, SignatureRow>;
  signatureRows: SignatureRow[];
  samples: SampleRecord[];
  samplesByClade: Map<string, SampleRecord[]>;
  samplesByCountry: Map<string, SampleRecord[]>;
  countries: Map<string, number>;
};

export type IndexSummary = Omit<TreeIndexSummary, "countries"> & {
  countries: [string, number][];
};

export type WorkerRequestPayload =
  | { type: "load"; url: string; sampleScope?: SampleScope }
  | {
      type: "analyze";
      target: number;
      selectedCountries: string[];
      presenceMode: PresenceMode;
      includeCrossing: boolean;
      maxDeltaYbp: number;
      minSamples: number;
      anchorId: string | null;
      scopeAllCountries: boolean;
      knownDensityKey?: string | null;
      densityIntervals?: readonly import("../shared/density-identity").DensityBin[];
    }
  | { type: "density"; selectedCountries: string[]; presenceMode: PresenceMode; minSamples: number;
      intervals: readonly import("../shared/density-identity").DensityBin[] }
  | { type: "signatureOptions"; query: string }
  | { type: "subcladeProfile"; clade: string; countries?: string[] }
  | { type: "countryEvidence"; country: string; anchorId: string }
  | { type: "countryOverview"; country: string; countries?: string[] };

export type WorkerRequest =
  | (WorkerRequestPayload & { id: number })
  | { id: number; type: "cancelLoad"; loadId: number };

export type WorkerResponse =
  | {
      id: number;
      type: "load";
      index: IndexSummary;
    }
  | { id: number; type: "analyze"; result: TimeAnalysisResult }
  | { id: number; type: "density"; densityRows: DensityRow[]; densityKey: string }
  | { id: number; type: "signatureOptions"; options: SignatureRow[] }
  | { id: number; type: "subcladeProfile"; profile: SubcladeProfile | null }
  | { id: number; type: "countryEvidence"; evidence: CountryEvidence | null; profile?: SubcladeProfile | null }
  | { id: number; type: "countryOverview"; overview: CountryOverview | null }
  | { id: number; type: "error"; message: string };

export type {
  AnalysisResult,
  DensityRow,
  NeighborSuggestions,
  PresenceMode,
  ResultRow,
  SignatureRow,
  SliceMode,
  TreeNodeRef,
};
