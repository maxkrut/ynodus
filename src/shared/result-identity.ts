import type { ResultRow } from "./types";

/** Stable identity used as the final ordering tie-breaker in worker and UI. */
export function resultIdentity(row: ResultRow): string {
  if (row.formedEvents) {
    return row.formedEvents
      .flatMap((event) => event.formedMembers.map((member) => member.node.id))
      .join("|");
  }
  return row.formedMembers?.map((member) => member.node.id).join("|") ?? row.node.id;
}
