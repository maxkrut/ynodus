import type { CountryEvidence, CountryOverview, EvidenceTreeNode, Locale, ResultRow, SubcladeProfile } from "../shared/types";
import type { TextKey } from "./i18n";
import type { ResultDetailScope } from "./research-history";

export type EvidenceRevealKind =
  | "profile-countries"
  | "profile-branches"
  | "profile-tree"
  | "profile-formed"
  | "country-branches"
  | "country-assignments";

export type ResearchMarkupOptions = {
  locale?: () => Locale;
  t: (key: TextKey) => string;
  formatCalendar: (ybp: number) => string;
  formatNumber: (value: number) => string;
  countryName: (code: string) => string;
  countryFlag: (code: string) => string;
  subcladeUrl: (id: string) => string;
  queryFormedRow?: (id: string) => ResultRow | undefined;
  resultDetail?: () => ResultDetailScope | null;
};

export type ResearchMarkup = {
  profile: (profile: SubcladeProfile) => string;
  profileInspector: (node: EvidenceTreeNode, isRoot: boolean, countryScope?: boolean) => string;
  countryEvidence: (evidence: CountryEvidence, profile?: SubcladeProfile | null, countries?: string[]) => string;
  countryOverview: (overview: CountryOverview) => string;
  loading: () => string;
  error: (message: string) => string;
};

export const EVIDENCE_REVEAL_INCREMENT = 80;
export const TREE_REVEAL_INCREMENT = 200;
