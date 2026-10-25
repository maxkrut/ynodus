import type { ResultRow } from "../shared/types";
import { nodeMacroGroup } from "../shared/haplogroups";

export function availableResultMacroGroups(
  rows: readonly ResultRow[],
): string[] {
  return [...new Set(rows.map((row) => nodeMacroGroup(row.node)))]
    .sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
}

export function filterRowsByMacroGroup(
  rows: readonly ResultRow[],
  macroGroup: string | null,
): ResultRow[] {
  if (!macroGroup) return [...rows];
  return rows.filter((row) => nodeMacroGroup(row.node) === macroGroup);
}
