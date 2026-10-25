import type { DensityRow } from "../shared/types";

type DensityFormedLayer = {
  formed: number;
  rootId: string;
  rows: DensityRow[];
  currentResultCount: number;
};

/**
 * Groups only real, connected parent -> child nodes that share one source date.
 * This remains density/context metadata: Formed canonical rows use the same
 * connected-date rule, while the density layer keeps its own unfiltered cohort.
 */
export function groupDensityFormedLayers(
  rows: DensityRow[],
  currentResultIds: ReadonlySet<string>,
): DensityFormedLayer[] {
  const uniqueRows = [...new Map(rows.map((row) => [row.node.id, row])).values()];
  const rowsById = new Map(uniqueRows.map((row) => [row.node.id, row]));
  const groups = new Map<string, DensityFormedLayer>();

  for (const row of uniqueRows) {
    const root = sameDateLayerRoot(row, rowsById);
    const key = `${row.node.formed}|${root.node.id}`;
    const layer = groups.get(key) ?? {
      formed: row.node.formed,
      rootId: root.node.id,
      rows: [],
      currentResultCount: 0,
    };
    layer.rows.push(row);
    if (currentResultIds.has(row.node.id)) layer.currentResultCount += 1;
    groups.set(key, layer);
  }

  return [...groups.values()]
    .map((layer) => ({
      ...layer,
      rows: orderLayerRows(layer.rows),
    }))
    .sort((a, b) =>
      b.formed - a.formed ||
      b.rows.length - a.rows.length ||
      a.rootId.localeCompare(b.rootId));
}

function sameDateLayerRoot(
  row: DensityRow,
  rowsById: ReadonlyMap<string, DensityRow>,
): DensityRow {
  let current = row;
  const seen = new Set<string>();
  while (current.parentId && !seen.has(current.node.id)) {
    seen.add(current.node.id);
    const parent = rowsById.get(current.parentId);
    if (!parent || parent.node.formed !== row.node.formed) break;
    current = parent;
  }
  return current;
}

function orderLayerRows(rows: DensityRow[]): DensityRow[] {
  const rowById = new Map(rows.map((row) => [row.node.id, row]));
  const ids = new Set(rows.map((row) => row.node.id));
  const depths = new Map<string, number>();
  const depth = (row: DensityRow): number => {
    const cached = depths.get(row.node.id);
    if (cached !== undefined) return cached;
    const trail: string[] = [];
    const seen = new Set<string>();
    let currentId: string | null = row.node.id;
    let value = -1;
    while (currentId) {
      const knownDepth = depths.get(currentId);
      if (knownDepth !== undefined) {
        value = knownDepth;
        break;
      }
      if (seen.has(currentId)) break;
      seen.add(currentId);
      trail.push(currentId);
      const parentId: string | null = rowById.get(currentId)?.parentId ?? null;
      if (!parentId || !ids.has(parentId)) break;
      currentId = parentId;
    }
    for (let index = trail.length - 1; index >= 0; index -= 1) {
      value += 1;
      depths.set(trail[index], value);
    }
    return depths.get(row.node.id) ?? 0;
  };
  for (const row of rows) depth(row);
  return [...rows].sort((a, b) => depth(a) - depth(b) || a.node.id.localeCompare(b.node.id));
}
