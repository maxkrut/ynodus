import type { DensityRow } from "../shared/types";
import { nodeMacroGroup } from "../shared/haplogroups";

export type DensityUnit = "subclades" | "parents";
export type ParentDating = { parentId: string | null; formed: number; macroGroup: string; rows: DensityRow[] };

/** Equal rounded ages alone are not evidence of a shared parent dating. */
export function densityParentGroups(rows: readonly DensityRow[]): ParentDating[] {
  const groups = new Map<string, ParentDating>();
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.node.id)) continue;
    seen.add(row.node.id);
    const parentId = row.parentId;
    const key = JSON.stringify([parentId ? "parent" : "unresolved", parentId ?? row.node.id, row.node.formed]);
    let group = groups.get(key);
    if (!group) {
      group = { parentId, formed: row.node.formed, macroGroup: row.parentMacroGroup ?? nodeMacroGroup(row.node), rows: [] };
      groups.set(key, group);
    }
    group.rows.push(row);
  }
  return [...groups.values()].sort((a, b) => b.rows.length - a.rows.length || b.formed - a.formed
    || (a.parentId ?? a.rows[0].node.id).localeCompare(b.parentId ?? b.rows[0].node.id));
}
