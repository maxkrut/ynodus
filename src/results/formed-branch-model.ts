import type { ResultRow } from "../shared/types";

export function formedBranchDetails(row: ResultRow): {
  events: NonNullable<ResultRow["formedEvents"]>;
  subcladeCount: number;
  formedSpan: NonNullable<ResultRow["formedSpan"]>;
  deltaRange: NonNullable<ResultRow["deltaRange"]>;
} {
  const events = row.formedEvents ?? [{
    node: row.node,
    path: row.path,
    formedMembers: row.formedMembers ?? [{ node: row.node, path: row.path }],
    total: row.total,
    delta: row.delta,
    countryCounts: row.countryCounts,
    parentEventId: null,
    viaParentId: null,
  }];
  return {
    events,
    subcladeCount: events.reduce((total, event) => total + event.formedMembers.length, 0),
    formedSpan: row.formedSpan ?? {
      olderYbp: Math.max(...events.map((event) => event.node.formed)),
      youngerYbp: Math.min(...events.map((event) => event.node.formed)),
    },
    deltaRange: row.deltaRange ?? {
      minYbp: Math.min(...events.map((event) => event.delta)),
      maxYbp: Math.max(...events.map((event) => event.delta)),
    },
  };
}

