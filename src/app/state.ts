import type {
  CountryEvidence,
  CountryOverview,
  DensityRow,
  Locale,
  NeighborSuggestions,
  PresenceMode,
  ResultRow,
  ResearchView,
  SortDirection,
  TableSortKey,
  TreeIndexSummary as TreeIndex,
  SubcladeProfile,
} from "../shared/types";
import type { TextKey } from "./i18n";
import type { ResultDetailScope } from "./research-history";
import {
  DEFAULT_LOCALE,
  DEFAULT_MAX_DELTA_YBP,
  DEFAULT_MIN_RESULT_SAMPLES,
  TABLE_INITIAL_ROW_LIMIT,
} from "./constants";

export type AppState = {
  index: TreeIndex | null;
  loading: boolean;
  locale: Locale;
  selectedCountries: Set<string>;
  countryFilter: string;
  minResultSamples: number;
  presenceMode: PresenceMode;
  countryMinimumOffer: { countries: string[]; minimum: number } | null;
  countryParticipation: { formed: string[]; crossing: string[] | null } | null;
  includeCrossing: boolean;
  maxDeltaYbp: number;
  /** Last explicitly chosen preset; exactness is derived from selectedCountries. */
  activePreset: string | null;
  researchView: ResearchView;
  profile: SubcladeProfile | null;
  resultDetail: ResultDetailScope | null;
  countryEvidence: CountryEvidence | null;
  countryProfile: SubcladeProfile | null;
  countryEvidenceCountries: string[];
  countryOverview: CountryOverview | null;
  countryEvidenceParentView: "profile" | "country-overview";
  researchBusy: boolean;
  researchError: string | null;
  analysisBusy: boolean;
  analysisCohortSampleCount: number | null;
  analysisResultSupportCount: number | null;
  results: ResultRow[];
  crossingResults: ResultRow[];
  densityRows: DensityRow[];
  /** Identity of the evidence-scope density currently retained on the main thread. */
  densityKey: string | null;
  tableRowLimit: number;
  tableSort: {
    key: TableSortKey;
    direction: SortDirection;
  };
  crossingTableRowLimit: number;
  crossingTableSort: {
    key: TableSortKey;
    direction: SortDirection;
  };
  /** Independent presentation-only filters for each committed table and its CSV rows. */
  resultMacroGroup: string | null;
  crossingMacroGroup: string | null;
  neighborSuggestions: NeighborSuggestions | null;
  committedQuery: CommittedQuerySnapshot | null;
  emptyMessageKey: TextKey | null;
  emptyErrorMessage: string | null;
  /** Raw runtime-index load failure detail; localized framing is rendered on demand. */
  loadErrorDetail: string | null;
};

export type CommittedQuerySnapshot = {
  selectedCountries: string[];
  presenceMode: PresenceMode;
  includeCrossing: boolean;
  minResultSamples: number;
  maxDeltaYbp: number;
  targetYbp: number;
  targetYear: string;
  targetEra: string;
  provenance?: QueryProvenance;
};

export type QueryProvenance = Pick<TreeIndex,
  "version" | "officialVersion" | "computedDate" | "generatedAt" | "sourceUrl" | "sourceManifestUrl" | "format" | "sampleScope"
>;

const DEFAULT_PRESENCE_MODE: PresenceMode = "all";
export function createInitialState(): AppState {
  return {
    index: null,
    loading: false,
    locale: DEFAULT_LOCALE,
    selectedCountries: new Set<string>(),
    countryFilter: "",
    minResultSamples: DEFAULT_MIN_RESULT_SAMPLES,
    presenceMode: DEFAULT_PRESENCE_MODE,
    countryMinimumOffer: null,
    countryParticipation: null,
    includeCrossing: false,
    maxDeltaYbp: DEFAULT_MAX_DELTA_YBP,
    activePreset: null,
    researchView: "time",
    profile: null,
    resultDetail: null,
    countryEvidence: null,
    countryProfile: null,
    countryEvidenceCountries: [],
    countryOverview: null,
    countryEvidenceParentView: "profile",
    researchBusy: false,
    researchError: null,
    analysisBusy: false,
    analysisCohortSampleCount: null,
    analysisResultSupportCount: null,
    results: [],
    crossingResults: [],
    densityRows: [],
    densityKey: null,
    tableRowLimit: TABLE_INITIAL_ROW_LIMIT,
    tableSort: {
      key: "total",
      direction: "desc",
    },
    crossingTableRowLimit: TABLE_INITIAL_ROW_LIMIT,
    crossingTableSort: {
      key: "total",
      direction: "desc",
    },
    resultMacroGroup: null,
    crossingMacroGroup: null,
    neighborSuggestions: null,
    committedQuery: null,
    emptyMessageKey: "emptyLoad",
    emptyErrorMessage: null,
    loadErrorDetail: null,
  };
}
