import type { SubcladeProfile } from "../shared/types";
import type { TextKey } from "./i18n";
import { renderEvidenceTreeTable, type EvidenceTableState } from "./evidence-tree-table";

export type ProfileMatrixOptions = {
  terminal?: () => boolean;
  ancientBreakdown?: () => boolean;
  t: (key: TextKey) => string; formatNumber: (n: number) => string;
  formatCalendar: (age: number) => string;
  countryFlag: (code: string) => string; countryName: (code: string) => string;
};
export const MATRIX_ROWS = 100;

export function renderProfileMatrix(profile: SubcladeProfile, rowLimit: number, offset: number, o: ProfileMatrixOptions,
  state: EvidenceTableState = {}): string {
  return renderEvidenceTreeTable(profile, { ...state, offset, pageSize: rowLimit }, o);
}
