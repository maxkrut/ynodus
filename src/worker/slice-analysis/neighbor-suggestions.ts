import type { NeighborSuggestions, PresenceMode, TreeIndex } from "../types";
import type { DensityEvidenceRow } from "./evidence";

/** Nearest source dates whose own time windows contain a surviving Formed event. */
export function findResultNeighbors(
  index: TreeIndex, groups: ReadonlyMap<string, DensityEvidenceRow>, codes: string[],
  presence: PresenceMode, minimum: number, target: number, window: number, anchor: string | null,
): NeighborSuggestions {
  const rows = [...groups.values()].sort((a, b) => a.node.formed - b.node.formed);
  const dates = [...new Set(rows.map(row => row.node.formed))];
  const result: NeighborSuggestions = { older: null, younger: null };
  if (!dates.length || !codes.length) return result;
  if (presence === "any") {
    for (const date of dates) {
      if (date < target) result.younger = date;
      else if (date > target) { result.older = date; break; }
    }
    return result;
  }

  // One difference array per country, reused immediately: O(dates + nodes) memory.
  // A sample contributes once even if several source dates fall in the same window.
  const required = new Array<bigint>(dates.length).fill(
    minimum === 0 ? (1n << BigInt(codes.length)) - 1n : 0n,
  );
  const bits = new Map(codes.map((code, i) => [code, 1n << BigInt(i)]));
  // Zero is strict: absent countries remain required at every proposed date.
  for (const code of minimum === 0 ? [] : codes) {
    const delta = new Float64Array(dates.length + 1);
    for (const sample of index.samplesByCountry.get(code) ?? []) {
      const start = anchor ? sample.path.findIndex(node => node.id === anchor) : 0;
      if (start < 0) continue;
      const ages = [...new Set(sample.path.slice(start).filter(node => node.formedKnown !== false)
        .map(node => node.formed))].sort((a, b) => a - b);
      let left = -1, right = -1;
      for (const age of ages) {
        const nextLeft = bound(dates, age - window, false);
        const nextRight = bound(dates, age + window, true);
        if (nextLeft > right) {
          if (left >= 0) { delta[left] += sample.count; delta[right] -= sample.count; }
          left = nextLeft;
        }
        right = Math.max(right, nextRight);
      }
      if (left >= 0) { delta[left] += sample.count; delta[right] -= sample.count; }
    }
    let count = 0;
    for (let i = 0; i < dates.length; i++) {
      count += delta[i];
      if (count >= Math.max(1, minimum)) required[i] |= bits.get(code)!;
    }
  }

  const masks = rows.map(row => {
    let mask = 0n;
    for (const [code, count] of row.countryCounts) if (count > 0) mask |= bits.get(code) ?? 0n;
    return mask;
  });
  const active = new Map<bigint, number>();
  let left = 0, right = 0, current = 0n, matches = 0;
  const qualifies = (mask: bigint) => current !== 0n && (mask & current) === current;
  const change = (mask: bigint, amount: number) => {
    const count = (active.get(mask) ?? 0) + amount;
    if (count) active.set(mask, count); else active.delete(mask);
    if (qualifies(mask)) matches += amount;
  };
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    if (current !== required[i]) {
      current = required[i]; matches = 0;
      for (const [mask, count] of active) if (qualifies(mask)) matches += count;
    }
    while (right < rows.length && rows[right].node.formed <= date + window) change(masks[right++], 1);
    while (left < right && rows[left].node.formed < date - window) change(masks[left++], -1);
    // Connected equal-age groups have their supported root here too; a matching
    // child implies a matching root. Grouping cannot change whether any row exists.
    if (!matches) continue;
    if (date < target) result.younger = date;
    else if (date > target) { result.older = date; break; }
  }
  return result;
}

function bound(values: number[], target: number, upper: boolean): number {
  let left = 0, right = values.length;
  while (left < right) {
    const middle = (left + right) >>> 1;
    if (values[middle] < target || (upper && values[middle] === target)) left = middle + 1;
    else right = middle;
  }
  return left;
}
