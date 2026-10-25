import type { ResultRow } from "../types";
import type { EvidenceRows, SampleEvidence } from "./evidence";

export function groupConnectedSameFormedEvidence(
  rawGroups: ReadonlyMap<string, ResultRow>,
  rawSampleEvidence: SampleEvidence[],
): Pick<EvidenceRows, "rows" | "sampleEvidence"> {
  const rawRows = [...rawGroups.values()];
  const rowsById = new Map(rawRows.map((row) => [row.node.id, row]));
  const membersByRoot = new Map<string, ResultRow[]>();

  for (const row of rawRows) {
    const root = sameFormedCandidateRoot(row, rowsById);
    const members = membersByRoot.get(root.node.id) ?? [];
    members.push(row);
    membersByRoot.set(root.node.id, members);
  }

  const canonicalRowsByKey = new Map<string, ResultRow>();
  const canonicalKeyByNodeId = new Map<string, string>();

  for (const members of membersByRoot.values()) {
    const orderedMembers = [...members].sort((a, b) =>
      a.path.length - b.path.length || a.node.id.localeCompare(b.node.id));
    const root = orderedMembers[0];
    const key = formedGroupKey(orderedMembers.map((row) => row.node.id), root.node.formed);
    const canonicalRow: ResultRow = {
      ...root,
      formedMembers: orderedMembers.map((member) => ({
        node: member.node,
        path: member.path,
      })),
      total: 0,
      countryCounts: new Map<string, number>(),
    };
    canonicalRowsByKey.set(key, canonicalRow);
    for (const member of orderedMembers) canonicalKeyByNodeId.set(member.node.id, key);
  }

  const sampleEvidence: SampleEvidence[] = [];
  for (const sample of rawSampleEvidence) {
    const resultKeys = [...new Set(
      sample.resultKeys
        .map((nodeId) => canonicalKeyByNodeId.get(nodeId))
        .filter((key): key is string => Boolean(key)),
    )];
    for (const key of resultKeys) {
      const row = canonicalRowsByKey.get(key);
      if (!row) continue;
      row.total += sample.count;
      row.countryCounts.set(
        sample.country,
        (row.countryCounts.get(sample.country) ?? 0) + sample.count,
      );
    }
    if (resultKeys.length > 0) sampleEvidence.push({ ...sample, resultKeys });
  }

  return { rows: [...canonicalRowsByKey.values()], sampleEvidence };
}

function sameFormedCandidateRoot(
  row: ResultRow,
  rowsById: ReadonlyMap<string, ResultRow>,
): ResultRow {
  let current = row;
  const seen = new Set<string>();
  while (!seen.has(current.node.id)) {
    seen.add(current.node.id);
    const parentId = current.path.at(-2)?.id;
    const parent = parentId ? rowsById.get(parentId) : undefined;
    if (!parent || parent.node.formed !== row.node.formed) break;
    current = parent;
  }
  return current;
}

export function formedGroupKey(memberIds: string[], formed: number): string {
  return `formed:${formed}:${memberIds.join(">")}`;
}

/**
 * Turns the surviving canonical dated events into one result per connected
 * upper branch. Only the upper event carries primary evidence; lower events
 * remain available as non-additive explanatory detail.
 */
export function groupConnectedFormedBranches(
  canonicalRows: ResultRow[],
  canonicalSampleEvidence: SampleEvidence[],
): Pick<EvidenceRows, "rows" | "sampleEvidence"> {
  if (canonicalRows.length === 0) return { rows: [], sampleEvidence: [] };

  const rowByEventKey = new Map<string, ResultRow>();
  const eventKeyByMemberId = new Map<string, string>();
  for (const row of canonicalRows) {
    const key = formedEventKey(row);
    rowByEventKey.set(key, row);
    for (const member of formedMembersOf(row)) {
      eventKeyByMemberId.set(member.node.id, key);
    }
  }

  const parentEventKey = new Map<string, string>();
  const viaParentId = new Map<string, string>();
  const childrenByEventKey = new Map<string, string[]>();
  for (const [eventKey, row] of rowByEventKey) {
    const parentId = formedMembersOf(row)[0]?.path.at(-2)?.id;
    const parentKey = parentId ? eventKeyByMemberId.get(parentId) : undefined;
    if (!parentKey || parentKey === eventKey) continue;
    parentEventKey.set(eventKey, parentKey);
    viaParentId.set(eventKey, parentId!);
    const children = childrenByEventKey.get(parentKey) ?? [];
    children.push(eventKey);
    childrenByEventKey.set(parentKey, children);
  }

  const branchRows: ResultRow[] = [];
  const branchKeyByUpperEventKey = new Map<string, string>();
  const roots = [...rowByEventKey.keys()]
    .filter((key) => !parentEventKey.has(key))
    .sort((a, b) => compareEventRows(rowByEventKey.get(a)!, rowByEventKey.get(b)!));

  for (const rootKey of roots) {
    const eventKeys: string[] = [];
    const queue = [rootKey];
    const seen = new Set<string>();
    let queueIndex = 0;
    while (queueIndex < queue.length) {
      const key = queue[queueIndex];
      queueIndex += 1;
      if (seen.has(key)) continue;
      seen.add(key);
      eventKeys.push(key);
      const children = [...(childrenByEventKey.get(key) ?? [])]
        .sort((a, b) => compareEventRows(rowByEventKey.get(a)!, rowByEventKey.get(b)!));
      queue.push(...children);
    }

    const events = eventKeys.map((key) => {
      const row = rowByEventKey.get(key)!;
      const parentKey = parentEventKey.get(key);
      return {
        node: row.node,
        path: row.path,
        formedMembers: formedMembersOf(row),
        total: row.total,
        delta: row.delta,
        countryCounts: row.countryCounts,
        parentEventId: parentKey ? rowByEventKey.get(parentKey)!.node.id : null,
        viaParentId: viaParentId.get(key) ?? null,
      };
    });
    const upper = rowByEventKey.get(rootKey)!;
    const formedValues = events.map((event) => event.node.formed);
    const deltaValues = events.map((event) => event.delta);
    const branchRow: ResultRow = {
      ...upper,
      formedMembers: formedMembersOf(upper),
      formedEvents: events,
      formedSpan: {
        olderYbp: Math.max(...formedValues),
        youngerYbp: Math.min(...formedValues),
      },
      deltaRange: {
        minYbp: Math.min(...deltaValues),
        maxYbp: Math.max(...deltaValues),
      },
    };
    const branchKey = formedBranchKey(events.map((event) => formedGroupKey(
      event.formedMembers.map((member) => member.node.id),
      event.node.formed,
    )));
    branchRows.push(branchRow);
    branchKeyByUpperEventKey.set(rootKey, branchKey);
  }

  const sampleEvidence = canonicalSampleEvidence.flatMap((sample) => {
    const resultKeys = [...new Set(sample.resultKeys
      .map((key) => branchKeyByUpperEventKey.get(key))
      .filter((key): key is string => Boolean(key)))];
    return resultKeys.length > 0 ? [{ ...sample, resultKeys }] : [];
  });
  return { rows: branchRows, sampleEvidence };
}

function formedMembersOf(row: ResultRow): NonNullable<ResultRow["formedMembers"]> {
  return row.formedMembers ?? [{ node: row.node, path: row.path }];
}

function formedEventKey(row: ResultRow): string {
  return formedGroupKey(formedMembersOf(row).map((member) => member.node.id), row.node.formed);
}

export function formedBranchKey(eventKeys: string[]): string {
  return `formed-branch:${eventKeys.join("|")}`;
}

function compareEventRows(a: ResultRow, b: ResultRow): number {
  return a.path.length - b.path.length || a.node.id.localeCompare(b.node.id);
}

