import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import { createSourceSnapshot, writeIndexAtomically } from "./data-snapshot.mjs";
import { migrateRuntimeFormat } from "./runtime-format-migration.mjs";
import {
  mergeNodes,
  parseReferenceTree,
  summarizeMerge,
} from "./build-hras-reference.mjs";

import { ANCIENT_URL, parseAncientIds } from "./ancient-samples.mjs";
import { fetchReferenceRelease } from "./reference-release.mjs";

export { mergeNodes } from "./build-hras-reference.mjs";

const DATA_ROOT = "https://hras.yseq.net/data/";
const PROJECT_ROOT = `${DATA_ROOT}haplogroups/y/`;
const REFERENCE_OWNER = `Y${"Full"}Team`;
const REFERENCE_REPO = "YTree";
const MANIFEST_TREE_VERSION_KEY = `Y${"Full"}-version`;
const OUT_FILE = "public/data/hras-index.json";

const PROJECTS = [
  "A00",
  "A0",
  "A1a",
  "A1b1",
  "B",
  "C",
  "D",
  "E",
  "F-Y27277",
  "G",
  "H",
  "I1",
  "I2",
  "J1",
  "J2",
  "K-Y28299",
  "L",
  "M",
  "N",
  "O",
  "Q",
  "R1a",
  "R1b",
  "R2",
  "S",
  "T",
];

const hrasNodes = {};
const sampleCounts = new Map();
const ancientCounts = new Map();
let ancientIds = new Set();
const countries = {};

if (isMainModule()) await main();

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--migrate-format") {
    const payload = migrateRuntimeFormat(JSON.parse(await readFile(OUT_FILE, "utf8")));
    await writeIndexAtomically(OUT_FILE, payload);
    console.log(`Migrated runtime namespace: ${payload.nodeCount} nodes, ${payload.sampleCount} samples; source snapshot unchanged.`);
    return;
  }
  if (args.length && (args.length !== 2 || args[0] !== "--source-lock")) {
    throw new Error("Usage: npm run data [-- --source-lock path-to-index-or-snapshot.json | --migrate-format]");
  }
  let expectedSnapshot = null;
  if (args.length) {
    const lock = JSON.parse(await readFile(args[1], "utf8"));
    expectedSnapshot = lock.inputSnapshot ?? lock;
  }
  const snapshot = createSourceSnapshot({ expectedSnapshot });
  const referenceRoot = await snapshot.pinReference(REFERENCE_OWNER, REFERENCE_REPO);
  const [manifestText, referenceMarkerFetch, referenceTreeText] = await Promise.all([
    snapshot.read(`${DATA_ROOT}manifest`, { verify: true }),
    fetchOptionalText(snapshot, `${referenceRoot}current_version.txt`),
    snapshot.read(`${referenceRoot}current_tree.json`),
  ]);
  const manifest = parseManifest(manifestText);
  const hrasManifest = assessHrasManifest(manifest);
  if (hrasManifest.degraded) throw new Error(hrasManifest.warning);
  const referenceMarker = assessReferenceMarker(referenceMarkerFetch);
  if (referenceMarker.degraded) throw new Error(referenceMarker.warning);

  ancientIds = parseAncientIds(await snapshot.read(ANCIENT_URL, { verify: true }));
  await mapWithConcurrency(PROJECTS, 4, async (project) => {
    const base = `${PROJECT_ROOT}${encodeURIComponent(project)}/`;
    const [treeText, samplesText] = await Promise.all([
      snapshot.read(`${base}${project}-lessoutliers-tree.txt`, { verify: true }),
      snapshot.read(`${base}${project}-samples.txt`, { verify: true }),
    ]);

    parseTree(project, treeText);
    parseSamples(samplesText);
    console.log(`Indexed ${project}`);
  });

  const referenceNodes = parseReferenceTree(referenceTreeText);
  const mergedNodes = mergeNodes(hrasNodes, referenceNodes);
  const compactIndex = compactRuntimeIndex(mergedNodes);
  const mergeStats = summarizeMerge(hrasNodes, referenceNodes, mergedNodes);
  await snapshot.verify(`${DATA_ROOT}manifest`);
  const referenceRelease = await fetchReferenceRelease(referenceRoot, referenceMarker.value);
  const payload = {
    format: "ynodus/hras-index-v3",
    formatVersion: 3,
    source: "HRAS public data with reference tree structure",
    sourceUrl: "https://hras.yseq.net/",
    sourceManifestUrl: `${DATA_ROOT}manifest`,
    treeOfficialVersion: referenceMarker.value,
    referenceRelease,
    licenseNotice:
      "Generated/normalized data artifact. Application code is Apache-2.0; reference tree is CC BY 4.0; HRAS source code is Apache-2.0. See project NOTICE.md.",
    sourceLicenses: {
      applicationCode: "Apache-2.0",
      referenceTree: "CC BY 4.0",
      hrasSourceCode: "Apache-2.0",
    },
    treeVersion: hrasManifest.treeVersion,
    computedDate: hrasManifest.computedDate,
    hrasManifestSampleCount: hrasManifest.manifestSampleCount,
    generatedAt: new Date().toISOString(),
    inputSnapshot: snapshot.metadata(),
    ageProvenance: {
      unit: "ybp",
      referenceDefinitionUrl: "https://www.yfull.com/faq/definitions/",
      referenceDefinition: "Years before the current year; for individual samples, the year age information was added to YTree. Not the radiocarbon 1950 epoch.",
      commonReferenceYear: null,
      hrasFallbackReferenceYear: null,
      calendarDisplayBaseYear: 1950,
      calendarDisplayStatus: "application-convention",
    },
    merge: mergeStats,
    projectCount: PROJECTS.length,
    nodeCount: compactIndex.nodeIds.length,
    sampleCount: compactIndex.samples.reduce((sum, sample) => sum + sample[2], 0),
    projectIds: compactIndex.projectIds,
    countryCodes: compactIndex.countryCodes,
    countryCounts: compactIndex.countryCounts,
    nodeIds: compactIndex.nodeIds,
    nodes: compactIndex.nodes,
    samples: compactIndex.samples,
    ancientCounts: compactIndex.ancientCounts,
    ancientClassification: { sourceUrl: ANCIENT_URL, method: "HRAS ancient-list identifier match", listedCount: ancientIds.size },
  };

  await writeIndexAtomically(OUT_FILE, payload);

  console.log(
    `Wrote ${OUT_FILE}: ${payload.nodeCount} nodes, ${payload.sampleCount} samples, ${payload.countryCodes.length} countries`,
  );
}

async function fetchOptionalText(snapshot, url) {
  try {
    return { available: true, value: await snapshot.read(url), error: null };
  } catch (error) {
    return {
      available: false,
      value: "unknown",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function assessReferenceMarker(fetchResult) {
  const marker = typeof fetchResult?.value === "string" ? fetchResult.value.trim() : "";
  if (fetchResult?.available === true && marker && marker.toLowerCase() !== "unknown") {
    return { value: marker, degraded: false, warning: null };
  }
  const detail = fetchResult?.error ? `: ${fetchResult.error}` : ".";
  return {
    value: "unknown",
    degraded: true,
    warning: `Official reference marker unavailable or unknown; the generated index cannot be built reproducibly${detail}`,
  };
}

export function assessHrasManifest(manifest) {
  const rawVersion = manifest?.[MANIFEST_TREE_VERSION_KEY];
  const treeVersion = typeof rawVersion === "string" ? rawVersion.trim() : "";
  const rawDate = manifest?.computedDate;
  const computedDate = typeof rawDate === "string" ? rawDate.trim() : "";
  const rawSamples = typeof manifest?.samples === "string"
    ? manifest.samples.trim()
    : manifest?.samples;
  const manifestSampleCount = typeof rawSamples === "number" || typeof rawSamples === "string"
    ? Number(rawSamples)
    : Number.NaN;
  const failures = [];

  if (!treeVersion || treeVersion.toLowerCase() === "unknown") {
    failures.push(`${MANIFEST_TREE_VERSION_KEY} is missing or unknown`);
  }
  if (!computedDate || !Number.isFinite(Date.parse(computedDate))) {
    failures.push("computedDate is missing or invalid");
  }
  if (!Number.isSafeInteger(manifestSampleCount) || manifestSampleCount <= 0) {
    failures.push("samples is not a positive safe integer");
  }

  return {
    treeVersion: treeVersion || "unknown",
    computedDate,
    manifestSampleCount: Number.isSafeInteger(manifestSampleCount) && manifestSampleCount > 0
      ? manifestSampleCount
      : null,
    degraded: failures.length > 0,
    warning: failures.length > 0
      ? `HRAS manifest provenance is incomplete; the generated index cannot be built reproducibly: ${failures.join("; ")}.`
      : null,
  };
}

function isMainModule() {
  return Boolean(process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url);
}

async function mapWithConcurrency(items, limit, worker) {
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        await worker(items[index], index);
      }
    },
  );
  await Promise.all(workers);
}

function parseManifest(text) {
  const result = {};
  for (const line of text.trim().split(/\r?\n/)) {
    const [key, ...rest] = line.split(",");
    if (key) result[key] = rest.join(",");
  }
  return result;
}

function parseTree(project, xml) {
  const tagRe = /<branch\b[^>]*\/>|<branch\b[^>]*>|<\/branch>/g;
  const stack = [];
  let match;

  while ((match = tagRe.exec(xml))) {
    const tag = match[0];

    if (tag.startsWith("</")) {
      stack.pop();
      continue;
    }

    const attrs = parseAttrs(tag);
    const id = attrs.name;
    if (!id) continue;

    const parent = stack.length > 0 ? stack[stack.length - 1] : null;
    hrasNodes[id] = {
      id,
      project,
      parent,
      formed: parseInteger(attrs.formed),
    };

    if (!tag.endsWith("/>")) stack.push(id);
  }
}

function parseSamples(text) {
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const comma = line.indexOf(",");
    if (comma < 1) continue;

    const clade = line.slice(0, comma);
    const rawSamples = line.slice(comma + 1).split(":");

    for (const rawSample of rawSamples) {
      const parts = rawSample.trim().split(/\s+/);
      if (parts.length < 5) continue;

      const country = parts[4]?.toUpperCase();
      if (!country || country.length < 2 || country.length > 3) continue;

      const key = `${clade}\t${country}`;
      sampleCounts.set(key, (sampleCounts.get(key) ?? 0) + 1);
      if (ancientIds.has(parts[0])) ancientCounts.set(key, (ancientCounts.get(key) ?? 0) + 1);
      countries[country] = (countries[country] ?? 0) + 1;
    }
  }
}

function compactRuntimeIndex(nodes) {
  const projectIds = [...new Set(Object.values(nodes).map((node) => node.project).filter(Boolean))].sort();
  const projectIndexById = new Map(projectIds.map((project, index) => [project, index]));
  const countryCodes = Object.keys(countries).sort();
  const countryIndexByCode = new Map(countryCodes.map((country, index) => [country, index]));
  const countryCounts = countryCodes.map((country) => countries[country] ?? 0);
  const nodeIds = Object.keys(nodes).sort((a, b) => a.localeCompare(b));
  const nodeIndexById = new Map(nodeIds.map((id, index) => [id, index]));
  const compactNodes = nodeIds.map((id) => {
    const node = nodes[id];
    return [
      projectIndexById.get(node.project) ?? -1,
      node.parent ? nodeIndexById.get(node.parent) ?? -1 : -1,
      node.formed,
    ];
  });
  const compactSamples = [...sampleCounts.entries()]
    .map(([key, count]) => {
      const [clade, country] = key.split("\t");
      const nodeIndex = nodeIndexById.get(clade);
      const countryIndex = countryIndexByCode.get(country);
      if (nodeIndex === undefined || countryIndex === undefined) return null;
      return [nodeIndex, countryIndex, count];
    })
    .filter(Boolean)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  return {
    projectIds,
    countryCodes,
    countryCounts,
    nodeIds,
    nodes: compactNodes,
    samples: compactSamples,
    ancientCounts: compactSamples.map(([node, country]) => ancientCounts.get(`${nodeIds[node]}\t${countryCodes[country]}`) ?? 0),
  };
}

function parseAttrs(tag) {
  const attrs = {};
  for (const match of tag.matchAll(/\s([A-Za-z0-9_-]+)="([^"]*)"/g)) {
    attrs[match[1]] = decodeXml(match[2]);
  }
  return attrs;
}

function parseInteger(value) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function decodeXml(value) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}
