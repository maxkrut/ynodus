import type { TreeNodeRef } from "./types";

// These are named nodes in the saved hierarchy, not prefixes of SNP identifiers.
const MACROGROUP_ROOTS = new Set((
  "A A0 A0-T A00 A1 A1a A1b1 B BT C CF CT D DE E F F-Y27277 F1 F2 F3 " +
  "G GHIJK H HIJK I I1 I2 IJ IJK J J1 J2 K K-Y28299 K2 L LT M N NO O P Q R R1 R1a R1b R2 S T"
).split(" "));

export function macroGroupAnchor(id: string): string | null {
  return MACROGROUP_ROOTS.has(id) ? id : null;
}

export function nodeMacroGroup(node: Pick<TreeNodeRef, "project" | "macroGroup">): string {
  return node.macroGroup ?? node.project;
}

const DISPLAY_GROUP_BY_PROJECT: Record<string, string> = {
  A00: "A00",
  "A0-T": "A0-T",
  A0: "A0-T",
  A1a: "A0-T",
  A1b1: "A0-T",
  "F-Y27277": "F",
  "K-Y28299": "K",
};

export function groupProject(project: string): string {
  const explicitGroup = DISPLAY_GROUP_BY_PROJECT[project];
  if (explicitGroup) return explicitGroup;
  return project.match(/^[A-Z]+/)?.[0] ?? project;
}
