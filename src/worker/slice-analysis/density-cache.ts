import type { DensityRow } from "../types";
import type { DensityEvidenceRow } from "./evidence";

const MAX_ENTRIES = 16, MAX_ROWS = 100_000;
const rows = new Map<string, DensityRow[]>();
// One raw country scope avoids rebuilding all country maps on every date change.
let evidence: { key: string; groups: Map<string, DensityEvidenceRow> } | undefined;

export function resetDensityCache(): void { rows.clear(); evidence = undefined; }
export function readDensityGroups(key: string): Map<string, DensityEvidenceRow> | undefined {
  return evidence?.key === key ? evidence.groups : undefined;
}
export function writeDensityGroups(key: string, groups: Map<string, DensityEvidenceRow>): void {
  evidence = groups.size <= MAX_ROWS ? { key, groups } : undefined;
}
export function readDensityRows(key: string): DensityRow[] | undefined {
  const value = rows.get(key);
  if (value) { rows.delete(key); rows.set(key, value); }
  return value;
}
export function writeDensityRows(key: string, value: DensityRow[]): void {
  rows.delete(key); rows.set(key, value);
  let count = 0;
  for (const cached of rows.values()) count += cached.length;
  while (rows.size > MAX_ENTRIES || count > MAX_ROWS) {
    const oldest = rows.keys().next().value;
    if (oldest === undefined) break;
    count -= rows.get(oldest)!.length;
    rows.delete(oldest);
  }
}
