import type { AncientEvidence, CountryEvidence, CountryOverview, EvidenceTreeNode, SubcladeProfile, TimeAnalysisResult } from "../shared/types";
import type { TreeIndex } from "./types";

function counts(index: TreeIndex, id: string, countries?: Iterable<string>): AncientEvidence {
  if (index.sampleScope !== "all" || index.ancientSampleCount === undefined) return {};
  const source = index.signatureIndex.get(id)?.ancientCountryCounts ?? new Map<string, number>();
  const selected = countries ? new Map([...countries].map(code => [code, source.get(code) ?? 0])) : new Map(source);
  return { ancientTotal: [...selected.values()].reduce((a, b) => a + b, 0), ancientCountryCounts: selected };
}

export function annotateTime(index: TreeIndex, result: TimeAnalysisResult): void {
  for (const set of [result.formed, result.crossing]) for (const row of set?.rows ?? []) {
    Object.assign(row, counts(index, row.crossingChild?.id ?? row.node.id, row.countryCounts.keys()));
    for (const event of row.formedEvents ?? []) Object.assign(event, counts(index, event.node.id, event.countryCounts.keys()));
  }
}

function tree(index: TreeIndex, node: EvidenceTreeNode, country?: string): void {
  Object.assign(node, counts(index, node.node.id, country ? [country] : node.countryCounts.keys()));
  for (const child of node.children) tree(index, child, country);
}

export function annotateProfile(index: TreeIndex, profile: SubcladeProfile | null): SubcladeProfile | null {
  if (!profile) return null;
  Object.assign(profile, counts(index, profile.node.id, profile.countryCounts.keys()));
  for (const branch of profile.immediateBranches) Object.assign(branch, counts(index, branch.node.id, branch.countryCounts.keys()));
  tree(index, profile.evidenceTree);
  return profile;
}

export function annotateCountry(index: TreeIndex, evidence: CountryEvidence | null): CountryEvidence | null {
  if (!evidence) return null;
  Object.assign(evidence, counts(index, evidence.anchor.id, [evidence.country]));
  for (const branch of evidence.immediateBranches) Object.assign(branch, counts(index, branch.node.id, [evidence.country]));
  return evidence;
}

export function annotateOverview(index: TreeIndex, overview: CountryOverview | null): CountryOverview | null {
  if (!overview) return null;
  for (const root of overview.roots) tree(index, root);
  if (index.sampleScope === "all" && index.ancientSampleCount !== undefined) {
    const direct = new Map<string, number>();
    for (const record of (overview.countries ?? [overview.country]).flatMap(code => index.samplesByCountry.get(code) ?? [])) {
      const id = record.path.at(-1)!.id;
      direct.set(id, (direct.get(id) ?? 0) + (record.ancientCount ?? 0));
    }
    overview.ancientTotal = [...direct.values()].reduce((a, b) => a + b, 0);
    for (const item of overview.assignments) item.ancientTotal = direct.get(item.node.id) ?? 0;
    for (const group of overview.groups) group.ancientTotal = group.assignments.reduce((sum, item) => sum + (direct.get(item.node.id) ?? 0), 0);
  }
  return overview;
}
