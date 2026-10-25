import type { SubcladeProfile } from "../shared/types";
import type { ProfileMatrixOptions } from "./profile-matrix";
import { renderEvidenceTreeTable, type EvidenceTableState } from "./evidence-tree-table";

export function renderBranchCountryMatrix(profile: SubcladeProfile, selected: string[], rows: number,
  offset: number, o: ProfileMatrixOptions, state: EvidenceTableState = {}): string {
  return renderEvidenceTreeTable(profile, { ...state, countries: selected, branch: true, offset, pageSize: rows }, o);
}
