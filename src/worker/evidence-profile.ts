import type {
  CountryAssignment,
  CountryEvidence,
  CountryOverview,
  CountryOverviewGroup,
  EvidenceBranch,
  EvidenceTreeNode,
  SubcladeProfile,
  TreeNodeRef,
} from "../shared/types";
import type { SampleRecord, TreeIndex } from "./types";
import { nodeMacroGroup } from "../shared/haplogroups";

type MutableEvidence = {
  node: TreeNodeRef;
  total: number;
  countryCounts: Map<string, number>;
};

type MutableEvidenceTreeNode = MutableEvidence & {
  directTotal: number;
  children: Map<string, MutableEvidenceTreeNode>;
};

export function subcladeProfileForClade(
  value: TreeIndex,
  clade: string,
  countries?: readonly string[],
): SubcladeProfile | null {
  const signature = value.signatureIndex.get(clade);
  if (!signature) return null;

  const selected = countries ? new Set(countries) : null;
  const supporting = supportingRecords((value.samplesByClade.get(clade) ?? [])
    .filter(record => !selected || selected.has(record.country)), clade);
  const path = pathToAnchor(supporting, clade);
  if (path.length === 0) return null;

  const directCountryCounts = new Map<string, number>();
  const branches = new Map<string, MutableEvidence>();
  const descendantIds = new Set<string>();
  const datedDescendantIds = new Set<string>();
  let directTotal = 0;
  const evidenceTree = mutableTreeNode(signature.node);

  for (const { record, anchorIndex } of supporting) {
    addRecordToTree(evidenceTree, record, anchorIndex);
    for (const descendant of record.path.slice(anchorIndex + 1)) {
      descendantIds.add(descendant.id);
      if (descendant.formedKnown) datedDescendantIds.add(descendant.id);
    }

    const child = record.path[anchorIndex + 1];
    if (!child) {
      directTotal += record.count;
      addCountryCount(directCountryCounts, record.country, record.count);
      continue;
    }
    addBranchEvidence(branches, child, record);
  }

  return {
    node: signature.node,
    path,
    parent: path.at(-2) ?? null,
    total: evidenceTree.total,
    countryCounts: new Map(evidenceTree.countryCounts),
    directTotal,
    directCountryCounts,
    immediateBranches: sortedBranches(branches),
    evidenceTree: freezeEvidenceTree(evidenceTree),
    supportedDescendantCount: descendantIds.size,
    datedDescendantCount: datedDescendantIds.size,
  };
}

function mutableTreeNode(node: TreeNodeRef): MutableEvidenceTreeNode {
  return { node, total: 0, directTotal: 0, countryCounts: new Map(), children: new Map() };
}

function addRecordToTree(
  root: MutableEvidenceTreeNode,
  record: SampleRecord,
  anchorIndex: number,
): void {
  let current = root;
  current.total += record.count;
  addCountryCount(current.countryCounts, record.country, record.count);
  for (const node of record.path.slice(anchorIndex + 1)) {
    const child = current.children.get(node.id) ?? mutableTreeNode(node);
    child.total += record.count;
    addCountryCount(child.countryCounts, record.country, record.count);
    current.children.set(node.id, child);
    current = child;
  }
  current.directTotal += record.count;
}

function freezeEvidenceTree(node: MutableEvidenceTreeNode): EvidenceTreeNode {
  return {
    node: node.node,
    total: node.total,
    directTotal: node.directTotal,
    countryCounts: node.countryCounts,
    children: [...node.children.values()]
      .sort(compareEvidence)
      .map(freezeEvidenceTree),
  };
}

export function countryEvidenceForBranch(
  value: TreeIndex,
  country: string,
  anchorId: string,
): CountryEvidence | null {
  const signature = value.signatureIndex.get(anchorId);
  if (!signature || !value.countries.has(country)) return null;

  const supporting = supportingRecords(value.samplesByCountry.get(country) ?? [], anchorId);
  if (supporting.length === 0) return null;

  const path = pathToAnchor(supporting, anchorId);
  const branches = new Map<string, MutableEvidence>();
  const assignments = new Map<string, CountryAssignment>();
  let directTotal = 0;
  let total = 0;

  for (const { record, anchorIndex } of supporting) {
    total += record.count;
    const child = record.path[anchorIndex + 1];
    if (child) addBranchEvidence(branches, child, record);
    else directTotal += record.count;

    const terminal = record.path.at(-1)!;
    const assignment = assignments.get(terminal.id) ?? { node: terminal, total: 0 };
    assignment.total += record.count;
    assignments.set(terminal.id, assignment);
  }

  return {
    country,
    anchor: signature.node,
    path,
    total,
    directTotal,
    immediateBranches: sortedBranches(branches),
    deepestAssignments: [...assignments.values()].sort(compareEvidence),
  };
}

export function countryOverviewForCountry(
  value: TreeIndex,
  country: string,
  comparisons: readonly string[] = [],
): CountryOverview | null {
  if (!/^[A-Z]{3}$/.test(country)) return null;
  const countries = [...new Set([country, ...comparisons])].filter(code => /^[A-Z]{3}$/.test(code)).sort();
  const countryCounts = new Map(countries.map(code => [code, 0]));
  const records = countries.flatMap(code => value.samplesByCountry.get(code) ?? []);
  if (!records.length && !value.countries?.has(country)) return null;

  const assignments = new Map<string, CountryAssignment>();
  const groups = new Map<string, { total: number; assignments: Map<string, CountryAssignment> }>();
  const roots = new Map<string, MutableEvidenceTreeNode>();
  let total = 0;
  for (const record of records) {
    const terminal = record.path.at(-1);
    if (!terminal) continue;
    const sourceRoot = record.path[0];
    const root = roots.get(sourceRoot.id) ?? mutableTreeNode(sourceRoot);
    addRecordToTree(root, record, 0);
    roots.set(sourceRoot.id, root);
    total += record.count;
    countryCounts.set(record.country, (countryCounts.get(record.country) ?? 0) + record.count);
    addAssignment(assignments, terminal, record.count);
    const macroGroup = nodeMacroGroup(terminal);
    const group = groups.get(macroGroup) ?? { total: 0, assignments: new Map() };
    group.total += record.count;
    addAssignment(group.assignments, terminal, record.count);
    groups.set(macroGroup, group);
  }

  return {
    country,
    countries,
    countryCounts,
    total,
    roots: [...roots.values()].sort(compareEvidence).map(freezeEvidenceTree),
    assignments: [...assignments.values()].sort(compareEvidence),
    groups: [...groups.entries()].map(([project, group]): CountryOverviewGroup => ({
      project,
      total: group.total,
      assignments: [...group.assignments.values()].sort(compareEvidence),
    })).sort((left, right) => right.total - left.total || left.project.localeCompare(right.project)),
  };
}

function addAssignment(
  assignments: Map<string, CountryAssignment>,
  node: TreeNodeRef,
  count: number,
): void {
  const assignment = assignments.get(node.id) ?? { node, total: 0 };
  assignment.total += count;
  assignments.set(node.id, assignment);
}

function supportingRecords(
  records: readonly SampleRecord[],
  anchorId: string,
): Array<{ record: SampleRecord; anchorIndex: number }> {
  const supporting: Array<{ record: SampleRecord; anchorIndex: number }> = [];
  for (const record of records) {
    const anchorIndex = record.path.findIndex((node) => node.id === anchorId);
    if (anchorIndex >= 0) supporting.push({ record, anchorIndex });
  }
  return supporting;
}

function pathToAnchor(
  supporting: readonly { record: SampleRecord; anchorIndex: number }[],
  anchorId: string,
): TreeNodeRef[] {
  const first = supporting[0];
  if (!first) return [];
  const path = first.record.path.slice(0, first.anchorIndex + 1);
  return path.at(-1)?.id === anchorId ? path : [];
}

function addBranchEvidence(
  branches: Map<string, MutableEvidence>,
  node: TreeNodeRef,
  record: SampleRecord,
): void {
  const branch = branches.get(node.id) ?? {
    node,
    total: 0,
    countryCounts: new Map<string, number>(),
  };
  branch.total += record.count;
  addCountryCount(branch.countryCounts, record.country, record.count);
  branches.set(node.id, branch);
}

function addCountryCount(counts: Map<string, number>, country: string, count: number): void {
  counts.set(country, (counts.get(country) ?? 0) + count);
}

function sortedBranches(branches: Map<string, MutableEvidence>): EvidenceBranch[] {
  return [...branches.values()].sort(compareEvidence);
}

function compareEvidence(
  left: { node: TreeNodeRef; total: number },
  right: { node: TreeNodeRef; total: number },
): number {
  return right.total - left.total || left.node.id.localeCompare(right.node.id);
}
