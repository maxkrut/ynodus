import type { ResultRow, SliceMode, SortDirection, TableSortKey } from "../shared/types";
import { resultIdentity } from "../shared/result-identity";

export type TableSortState = {
  key: TableSortKey;
  direction: SortDirection;
};

export function tableSortForMode(sort: TableSortState, sliceMode: SliceMode): TableSortState {
  return sliceMode === "crossing" && sort.key === "delta"
    ? { key: "total", direction: "desc" }
    : sort;
}

export function compareRowsByTableSort(
  a: ResultRow,
  b: ResultRow,
  sort: TableSortState,
): number {
  const direction = sort.direction === "asc" ? 1 : -1;
  let result = 0;

  if (sort.key === "subclade") {
    result = compareResultRowIdentity(a, b);
  } else if (sort.key === "formed") {
    result = (a.formedSpan?.olderYbp ?? a.node.formed)
      - (b.formedSpan?.olderYbp ?? b.node.formed);
  } else if (sort.key === "delta") {
    result = (a.deltaRange?.minYbp ?? a.delta) - (b.deltaRange?.minYbp ?? b.delta);
  } else {
    result = a.total - b.total;
  }

  if (result !== 0) return result * direction;
  return compareResultRowIdentity(a, b);
}

function compareResultRowIdentity(a: ResultRow, b: ResultRow): number {
  const parentOrder = resultIdentity(a).localeCompare(resultIdentity(b));
  if (parentOrder !== 0) return parentOrder;
  return (a.crossingChild?.id ?? "").localeCompare(b.crossingChild?.id ?? "");
}

export function isTableSortKey(value: string | undefined): value is TableSortKey {
  return value === "subclade" || value === "formed" || value === "delta" || value === "total";
}

export function defaultTableSortDirection(key: TableSortKey): SortDirection {
  return key === "total" ? "desc" : "asc";
}

function compareCountryEntries(a: [string, number], b: [string, number]): number {
  return b[1] - a[1] || a[0].localeCompare(b[0]);
}

const sortedCountryEntriesCache = new WeakMap<Map<string, number>, [string, number][]>();

export function sortedCountryEntries(countryCounts: Map<string, number>): [string, number][] {
  const cached = sortedCountryEntriesCache.get(countryCounts);
  if (cached) return cached;

  const entries = [...countryCounts.entries()].sort(compareCountryEntries);
  sortedCountryEntriesCache.set(countryCounts, entries);
  return entries;
}
