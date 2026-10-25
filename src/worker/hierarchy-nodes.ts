import { macroGroupAnchor } from "../shared/haplogroups";
import type { HrasIndex } from "./types";

export type SourceNode = {
  id: string; project: string; macroGroup: string;
  parent: string | null; formed: number | null;
};

/** Hydrates a validated index without rewriting its projects, dates or real edges. */
export function expandNodes(data: Pick<HrasIndex, "nodeIds" | "nodes" | "projectIds">): Record<string, SourceNode> {
  const anchors: Array<string | null | undefined> = new Array(data.nodes.length);
  // Memoized upward walks visit each edge once, including parents stored after children.
  for (let i = 0; i < data.nodes.length; i++) {
    const pending: number[] = [];
    let current = i;
    while (current >= 0 && anchors[current] === undefined) {
      const anchor = macroGroupAnchor(data.nodeIds[current]);
      if (anchor) { anchors[current] = anchor; break; }
      pending.push(current);
      current = data.nodes[current][1];
    }
    const anchor = current >= 0 ? anchors[current] ?? null : null;
    for (const index of pending) anchors[index] = anchor;
  }
  const nodes: Record<string, SourceNode> = {};
  data.nodes.forEach(([projectIndex, parentIndex, formed], index) => {
    const id = data.nodeIds[index], project = data.projectIds[projectIndex];
    nodes[id] = { id, project, macroGroup: anchors[index] ?? project,
      parent: parentIndex >= 0 ? data.nodeIds[parentIndex] : null, formed };
  });
  return nodes;
}
