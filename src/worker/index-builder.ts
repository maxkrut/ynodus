import type { SampleScope } from "../shared/types";
import { DEFAULT_FULL_RANGE_MAX_YBP } from "../shared/time";
import type {
  HrasIndex,
  IndexSummary,
  SampleRecord,
  SignatureRow,
  TreeIndex,
  TreeNodeRef,
} from "./types";
import { buildEvidenceIndexes } from "./evidence-index";
import { expandNodes, type SourceNode } from "./hierarchy-nodes";

type SourceSample = {
  node: string;
  country: string;
  count: number;
  ancientCount?: number;
};

export function buildIndex(data: HrasIndex, sampleScope: SampleScope = "all"): TreeIndex {
  assertCompactIndex(data);
  if (sampleScope !== "all" && !data.ancientCounts) throw new Error("Ancient classification is unavailable in this snapshot.");
  const nodesById = expandNodes(data);
  const pathCache = new Map<string, TreeNodeRef[]>();
  const samples: SampleRecord[] = [];
  const samplesByCountry = new Map<string, SampleRecord[]>();
  const countries = expandCountries(data);
  let maxFormedYbp = DEFAULT_FULL_RANGE_MAX_YBP;

  for (const node of Object.values(nodesById)) {
    if (typeof node.formed === "number") {
      maxFormedYbp = Math.max(maxFormedYbp, node.formed);
    }
  }

  if (sampleScope !== "all") for (const code of countries.keys()) countries.set(code, 0);
  for (const sample of expandSamples(data)) {
    const count = sampleScope === "ancient" ? sample.ancientCount! : sampleScope === "modern" ? sample.count - sample.ancientCount! : sample.count;
    if (!count) continue;
    if (sampleScope !== "all") countries.set(sample.country, (countries.get(sample.country) ?? 0) + count);
    const path = pathForClade(sample.node, nodesById, pathCache);
    if (path.length === 0) continue;
    const record = {
      country: sample.country,
      count,
      ancientCount: sampleScope === "modern" ? 0 : sample.ancientCount,
      path,
    } satisfies SampleRecord;

    samples.push(record);
    const countrySamples = samplesByCountry.get(sample.country) ?? [];
    countrySamples.push(record);
    samplesByCountry.set(sample.country, countrySamples);
  }

  const totalSamples = samples.reduce((sum, sample) => sum + sample.count, 0);
  const { signatureIndex, samplesByClade } = buildEvidenceIndexes(samples);
  const builtIndex: TreeIndex = {
    format: data.format,
    formatVersion: data.formatVersion,
    source: data.source,
    sourceUrl: data.sourceUrl,
    sourceManifestUrl: data.sourceManifestUrl,
    licenseNotice: data.licenseNotice,
    sourceLicenses: {
      applicationCode: data.sourceLicenses.applicationCode,
      referenceTree: data.sourceLicenses.referenceTree,
      hrasSourceCode: data.sourceLicenses.hrasSourceCode,
    },
    version: data.treeVersion,
    officialVersion: data.treeOfficialVersion,
    referenceRelease: data.referenceRelease,
    computedDate: data.computedDate,
    generatedAt: data.generatedAt,
    manifestSampleCount: data.hrasManifestSampleCount,
    nodes: data.nodeCount ?? data.nodeIds.length,
    maxFormedYbp,
    sampleCount: totalSamples,
    sampleScope,
    snapshotSampleCount: data.sampleCount ?? totalSamples,
    ancientSampleCount: data.ancientCounts?.reduce((a, b) => a + b, 0),
    signatureIndex,
    signatureRows: [...signatureIndex.values()].sort(compareSignatureRows),
    samples,
    samplesByClade,
    samplesByCountry,
    countries,
  };
  return builtIndex;
}

export function summarizeIndex(value: TreeIndex): IndexSummary {
  return {
    format: value.format,
    formatVersion: value.formatVersion,
    source: value.source,
    sourceUrl: value.sourceUrl,
    sourceManifestUrl: value.sourceManifestUrl,
    licenseNotice: value.licenseNotice,
    sourceLicenses: value.sourceLicenses,
    version: value.version,
    officialVersion: value.officialVersion,
    referenceRelease: value.referenceRelease,
    computedDate: value.computedDate,
    generatedAt: value.generatedAt,
    manifestSampleCount: value.manifestSampleCount,
    nodes: value.nodes,
    maxFormedYbp: value.maxFormedYbp,
    sampleCount: value.sampleCount,
    sampleScope: value.sampleScope,
    snapshotSampleCount: value.snapshotSampleCount,
    ancientSampleCount: value.ancientSampleCount,
    countries: [...value.countries.entries()],
  };
}

function assertCompactIndex(data: HrasIndex): void {
  if (
    !data ||
    typeof data !== "object" ||
    data.formatVersion !== 3 ||
    data.format !== "ynodus/hras-index-v3" ||
    !Array.isArray(data.nodeIds) ||
    !Array.isArray(data.nodes) ||
    !Array.isArray(data.projectIds) ||
    !Array.isArray(data.countryCodes) ||
    !Array.isArray(data.countryCounts) ||
    !Array.isArray(data.samples)
  ) {
    throw new Error("Unsupported HRAS index format.");
  }

  assertKnownMarker("treeVersion", data.treeVersion);
  assertParseableDate("computedDate", data.computedDate);
  assertNonEmptyString("source", data.source);
  assertNonEmptyString("sourceUrl", data.sourceUrl);
  assertNonEmptyString("sourceManifestUrl", data.sourceManifestUrl);
  assertHttpsUrl("sourceUrl", data.sourceUrl);
  assertHttpsUrl("sourceManifestUrl", data.sourceManifestUrl);
  assertNonEmptyString("licenseNotice", data.licenseNotice);
  assertKnownMarker("treeOfficialVersion", data.treeOfficialVersion);
  assertParseableDate("generatedAt", data.generatedAt);
  if (!data.sourceLicenses || typeof data.sourceLicenses !== "object") {
    invalidIndex("sourceLicenses", "must be present");
  }
  assertNonEmptyString("sourceLicenses.applicationCode", data.sourceLicenses.applicationCode);
  assertNonEmptyString("sourceLicenses.referenceTree", data.sourceLicenses.referenceTree);
  assertNonEmptyString("sourceLicenses.hrasSourceCode", data.sourceLicenses.hrasSourceCode);
  assertUniqueStringArray("projectIds", data.projectIds, true);
  assertUniqueStringArray("countryCodes", data.countryCodes, true);
  assertUniqueStringArray("nodeIds", data.nodeIds, true);

  if (data.nodes.length !== data.nodeIds.length) {
    invalidIndex("nodes", `length ${data.nodes.length} does not match nodeIds ${data.nodeIds.length}`);
  }
  if (data.countryCounts.length !== data.countryCodes.length) {
    invalidIndex(
      "countryCounts",
      `length ${data.countryCounts.length} does not match countryCodes ${data.countryCodes.length}`,
    );
  }
  if (data.nodeCount !== undefined) {
    assertPositiveSafeInteger("nodeCount", data.nodeCount);
    if (data.nodeCount !== data.nodeIds.length) {
      invalidIndex("nodeCount", `${data.nodeCount} does not match nodeIds ${data.nodeIds.length}`);
    }
  }
  assertPositiveSafeInteger("hrasManifestSampleCount", data.hrasManifestSampleCount);

  data.countryCounts.forEach((count, index) => {
    assertNonNegativeSafeInteger(`countryCounts[${index}]`, count);
  });

  data.nodes.forEach((entry, index) => {
    if (!Array.isArray(entry) || entry.length !== 3) {
      invalidIndex(`nodes[${index}]`, "must contain exactly 3 values");
    }
    const [projectIndex, parentIndex, formed] = entry;
    assertIndex(`nodes[${index}][0]`, projectIndex, data.projectIds.length);
    if (!Number.isSafeInteger(parentIndex) || parentIndex < -1 || parentIndex >= data.nodeIds.length) {
      invalidIndex(`nodes[${index}][1]`, `parent index ${parentIndex} is out of range`);
    }
    if (parentIndex === index) {
      invalidIndex(`nodes[${index}][1]`, "node cannot be its own parent");
    }
    assertYbpOrNull(`nodes[${index}][2]`, formed);
  });
  assertAcyclicParentIndexes(data);

  if (data.ancientCounts && data.ancientCounts.length !== data.samples.length) invalidIndex("ancientCounts", "length must match samples");
  let sampleTotal = 0;
  const sampleTotalsByCountry = new Array<number>(data.countryCodes.length).fill(0);
  data.samples.forEach((entry, index) => {
    if (!Array.isArray(entry) || entry.length !== 3) {
      invalidIndex(`samples[${index}]`, "must contain exactly 3 values");
    }
    const [nodeIndex, countryIndex, count] = entry;
    assertIndex(`samples[${index}][0]`, nodeIndex, data.nodeIds.length);
    assertIndex(`samples[${index}][1]`, countryIndex, data.countryCodes.length);
    assertPositiveSafeInteger(`samples[${index}][2]`, count);
    if (data.ancientCounts) {
      const ancient = data.ancientCounts[index];
      assertNonNegativeSafeInteger(`ancientCounts[${index}]`, ancient);
      if (ancient > count) invalidIndex("ancientCounts", "ancient subset exceeds sample total");
    }
    sampleTotal += count;
    sampleTotalsByCountry[countryIndex] += count;
    if (!Number.isSafeInteger(sampleTotal)) {
      invalidIndex("samples", "total sample count exceeds the safe integer range");
    }
    if (!Number.isSafeInteger(sampleTotalsByCountry[countryIndex])) {
      invalidIndex(
        `samples[${index}][2]`,
        `country total for ${data.countryCodes[countryIndex]} exceeds the safe integer range`,
      );
    }
  });
  data.countryCounts.forEach((count, index) => {
    if (count !== sampleTotalsByCountry[index]) {
      invalidIndex(
        `countryCounts[${index}]`,
        `${count} does not match samples total ${sampleTotalsByCountry[index]} for ${data.countryCodes[index]}`,
      );
    }
  });
  if (data.sampleCount !== undefined) {
    assertPositiveSafeInteger("sampleCount", data.sampleCount);
    if (data.sampleCount !== sampleTotal) {
      invalidIndex("sampleCount", `${data.sampleCount} does not match sample tuples total ${sampleTotal}`);
    }
  }
}

function assertNonEmptyString(path: string, value: unknown): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    invalidIndex(path, "must be a non-empty string");
  }
}

function assertKnownMarker(path: string, value: unknown): asserts value is string {
  assertNonEmptyString(path, value);
  if (value.trim().toLowerCase() === "unknown") {
    invalidIndex(path, "must be a recorded source marker, not 'unknown'");
  }
}

function assertParseableDate(path: string, value: unknown): asserts value is string {
  assertNonEmptyString(path, value);
  if (!Number.isFinite(Date.parse(value))) {
    invalidIndex(path, "must be a parseable recorded date");
  }
}

function assertHttpsUrl(path: string, value: string): void {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") invalidIndex(path, "must use HTTPS");
  } catch {
    invalidIndex(path, "must be a valid HTTPS URL");
  }
}

function assertUniqueStringArray(path: string, values: unknown[], requireValues: boolean): void {
  if (requireValues && values.length === 0) invalidIndex(path, "must not be empty");
  const seen = new Set<string>();
  values.forEach((value, index) => {
    assertNonEmptyString(`${path}[${index}]`, value);
    if (seen.has(value)) invalidIndex(`${path}[${index}]`, `duplicates ${value}`);
    seen.add(value);
  });
}

function assertIndex(path: string, value: unknown, length: number): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) >= length) {
    invalidIndex(path, `index ${String(value)} is out of range`);
  }
}

function assertPositiveSafeInteger(path: string, value: unknown): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    invalidIndex(path, "must be a positive safe integer");
  }
}

function assertNonNegativeSafeInteger(path: string, value: unknown): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    invalidIndex(path, "must be a non-negative safe integer");
  }
}

function assertYbpOrNull(path: string, value: unknown): void {
  if (value === null) return;
  assertNonNegativeSafeInteger(path, value);
}

function assertAcyclicParentIndexes(data: HrasIndex): void {
  const state = new Uint8Array(data.nodes.length);
  for (let start = 0; start < data.nodes.length; start += 1) {
    if (state[start] === 2) continue;
    const trail: number[] = [];
    let current = start;
    while (current >= 0 && state[current] !== 2) {
      if (state[current] === 1) {
        invalidIndex(`nodes[${current}][1]`, "parent indexes contain a cycle");
      }
      state[current] = 1;
      trail.push(current);
      current = data.nodes[current][1];
    }
    for (const nodeIndex of trail) state[nodeIndex] = 2;
  }
}

function invalidIndex(path: string, reason: string): never {
  throw new Error(`Invalid HRAS index at ${path}: ${reason}.`);
}

function expandCountries(data: HrasIndex): Map<string, number> {
  return new Map(
    data.countryCodes.map((country, index) => [
      country,
      data.countryCounts[index],
    ]),
  );
}

function* expandSamples(data: HrasIndex): Generator<SourceSample> {
  for (let i = 0; i < data.samples.length; i++) {
    const [nodeIndex, countryIndex, count] = data.samples[i];
    const node = data.nodeIds[nodeIndex];
    const country = data.countryCodes[countryIndex];
    yield {
      node,
      country,
      count,
      ancientCount: data.ancientCounts?.[i],
    };
  }
}

function pathForClade(
  clade: string,
  nodes: Record<string, SourceNode>,
  cache: Map<string, TreeNodeRef[]>,
): TreeNodeRef[] {
  const cached = cache.get(clade);
  if (cached) return cached;

  const path: TreeNodeRef[] = [];
  let current: string | null = clade;

  while (current) {
    const node: SourceNode | undefined = nodes[current];
    if (!node) {
      throw new Error(`Validated source path contains missing node ${current}.`);
    }
    path.push({
      id: node.id,
      project: node.project,
      macroGroup: node.macroGroup,
      formed: typeof node.formed === "number" ? node.formed : 0,
      formedKnown: typeof node.formed === "number" && node.formed > 0,
    });
    current = node.parent;
  }

  path.reverse();
  cache.set(clade, path);
  return path;
}

function compareSignatureRows(a: SignatureRow, b: SignatureRow): number {
  if (b.total !== a.total) return b.total - a.total;
  return a.node.id.localeCompare(b.node.id);
}
