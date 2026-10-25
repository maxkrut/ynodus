import type { ResultRow } from "../types";
import { resultIdentity } from "../../shared/result-identity";

export function compareRowsByTotalDeltaId(a: ResultRow, b: ResultRow): number {
  if (b.total !== a.total) return b.total - a.total;
  if (a.delta !== b.delta) return a.delta - b.delta;
  const parentOrder = resultIdentity(a).localeCompare(resultIdentity(b));
  if (parentOrder !== 0) return parentOrder;
  return (a.crossingChild?.id ?? "").localeCompare(b.crossingChild?.id ?? "");
}
