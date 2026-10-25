import type {
  DensityRow,
  ResultRow,
  SliceMode,
  TreeIndex,
} from "../types";
import { groupConnectedSameFormedEvidence } from "./formed-groups";
import { nodeMacroGroup } from "../../shared/haplogroups";

export type EvidenceRows = {
  rows: ResultRow[];
  sampleEvidence: SampleEvidence[];
  /** Populated only when the cohort density cache misses, during the same sample/path pass. */
  densityGroups: Map<string, DensityEvidenceRow> | null;
};

export type DensityEvidenceRow = DensityRow & {
  countryCounts: Map<string, number>;
};

export type SampleEvidence = {
  country: string;
  count: number;
  resultKeys: string[];
};

export function collectEvidenceRows(
  value: TreeIndex,
  selectedCodes: string[],
  anchorId: string | null,
  sliceMode: SliceMode,
  target: number,
  maxDeltaYbp: number,
  collectDensity: boolean,
): EvidenceRows {
  const groups = new Map<string, ResultRow>();
  const sampleEvidence: SampleEvidence[] = [];
  const densityGroups = collectDensity ? new Map<string, DensityEvidenceRow>() : null;

  for (const country of selectedCodes) {
    const samples = value.samplesByCountry.get(country);
    if (!samples) continue;

    for (const sample of samples) {
      const scopeStart = anchorId
        ? sample.path.findIndex((node) => node.id === anchorId)
        : 0;
      if (scopeStart < 0) continue;
      const resultKeys: string[] = [];

      for (let pathIndex = scopeStart; pathIndex < sample.path.length; pathIndex += 1) {
        const node = sample.path[pathIndex];
        if (node.formedKnown === false) continue;
        if (densityGroups) {
          const density = addDensityEvidence(
            densityGroups,
            node,
            sample.path[pathIndex - 1]?.id ?? null,
            sample.country,
            sample.count,
          );
          const parent = sample.path[pathIndex - 1];
          if (parent) density.parentMacroGroup = nodeMacroGroup(parent);
        }

        if (
          sliceMode === "formed" &&
          node.formed >= target - maxDeltaYbp &&
          node.formed <= target + maxDeltaYbp
        ) {
          addSampleEvidence(
            groups,
            node,
            sample.path,
            sample.country,
            sample.count,
            target,
            "formed-in-slice",
          );
          resultKeys.push(node.id);
        }

        if (sliceMode !== "crossing") continue;
        const child = sample.path[pathIndex + 1];
        if (!child || child.formedKnown === false || !edgeCrossesTarget(node, child, target)) {
          continue;
        }
        const edgeKey = crossingEdgeKey(node.id, child.id);
        addSampleEvidence(
          groups,
          node,
          sample.path,
          sample.country,
          sample.count,
          target,
          "crossing-through",
          edgeKey,
          child,
        );
        resultKeys.push(edgeKey);
      }

      if (resultKeys.length > 0) {
        sampleEvidence.push({ country: sample.country, count: sample.count, resultKeys });
      }
    }
  }

  const canonicalEvidence = sliceMode === "formed"
    ? groupConnectedSameFormedEvidence(groups, sampleEvidence)
    : { rows: [...groups.values()], sampleEvidence };

  return {
    rows: canonicalEvidence.rows,
    sampleEvidence: canonicalEvidence.sampleEvidence,
    densityGroups,
  };
}

/**
 * Collapses only connected parent -> child candidates that share an exact
 * source formed date. Evidence is rebuilt from sample records so one sample
 * supporting several ancestors/descendants contributes only once to the
 * canonical group total and country count.
 */
function addDensityEvidence(
  groups: Map<string, DensityEvidenceRow>,
  node: ResultRow["node"],
  parentId: string | null,
  country: string,
  count: number,
): DensityEvidenceRow {
  const current = groups.get(node.id) ?? createDensityRow(node, parentId);
  current.total += count;
  current.countryCounts.set(country, (current.countryCounts.get(country) ?? 0) + count);
  groups.set(node.id, current);
  return current;
}

function createDensityRow(
  node: ResultRow["node"],
  parentId: string | null,
): DensityEvidenceRow {
  return {
    node: {
      id: node.id,
      project: node.project,
      macroGroup: node.macroGroup,
      formed: node.formed,
    },
    parentId,
    total: 0,
    countryCounts: new Map<string, number>(),
  };
}

function addSampleEvidence(
  groups: Map<string, ResultRow>,
  node: ResultRow["node"],
  path: ResultRow["path"],
  country: string,
  count: number,
  target: number,
  sliceRelation: NonNullable<ResultRow["sliceRelation"]>,
  groupKey = node.id,
  crossingChild?: ResultRow["node"],
): void {
  const current = groups.get(groupKey) ?? createEvidenceRow(
    node,
    path,
    target,
    sliceRelation,
    crossingChild,
  );
  current.total += count;
  current.countryCounts.set(country, (current.countryCounts.get(country) ?? 0) + count);
  groups.set(groupKey, current);
}

function createEvidenceRow(
  node: ResultRow["node"],
  path: ResultRow["path"],
  target: number,
  sliceRelation: NonNullable<ResultRow["sliceRelation"]>,
  crossingChild?: ResultRow["node"],
): ResultRow {
  return {
    node,
    path: resultPath(path, node.id, crossingChild?.id),
    total: 0,
    delta: Math.abs(node.formed - target),
    countryCounts: new Map<string, number>(),
    sliceRelation,
    crossingChild,
  };
}

function resultPath(
  samplePath: ResultRow["path"],
  nodeId: string,
  crossingChildId?: string,
): ResultRow["path"] {
  const endpointId = crossingChildId ?? nodeId;
  const endpointIndex = samplePath.findIndex((node) => node.id === endpointId);
  if (endpointIndex < 0) {
    throw new Error(`Result endpoint ${endpointId} is missing from its source path.`);
  }
  const path = samplePath.slice(0, endpointIndex + 1);
  const parentIndex = path.findIndex((node) => node.id === nodeId);
  if (parentIndex < 0 || (crossingChildId && parentIndex !== path.length - 2)) {
    throw new Error(`Crossing edge ${nodeId}>${crossingChildId ?? ""} is not contiguous in its source path.`);
  }
  return path;
}

function edgeCrossesTarget(
  parent: ResultRow["node"],
  child: ResultRow["node"],
  target: number,
): boolean {
  const younger = Math.min(parent.formed, child.formed);
  const older = Math.max(parent.formed, child.formed);
  return target >= younger && target <= older;
}

export function crossingEdgeKey(parentId: string, childId: string): string {
  return `${parentId}>${childId}`;
}
