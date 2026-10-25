// Read public source files in memory; persist hashes/counts, never sample identifiers.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dataBytes = await fs.readFile(path.join(root, "public/data/hras-index.json"));
const data = JSON.parse(dataBytes), sha = (x) => createHash("sha256").update(x).digest("hex");
const projects = ["A00", "A0", "A1a", "A1b1", "B", "C", "D", "E", "F-Y27277", "G", "H", "I1", "I2", "J1", "J2", "K-Y28299", "L", "M", "N", "O", "Q", "R1a", "R1b", "R2", "S", "T"];
const report = { checkedAt: new Date().toISOString(), dataSha256: sha(dataBytes), sources: [],
  recordCounts: { raw: 0, accepted: 0, shortFields: 0, invalidCountryLength: 0, malformedLines: 0,
    duplicateRecordIds: 0, duplicateIdDifferentAssignment: 0, acceptedMissingLocalClade: 0 },
  versions: { hras: data.treeVersion, reference: data.treeOfficialVersion } };
async function fetchBytes(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error(`Source HTTP ${response.status}: ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 50000000) throw new Error("Audit source exceeds size bound");
  report.sources.push({ url, sha256: sha(bytes), bytes: bytes.length });
  return bytes;
}
function unzipJson(bytes) {
  // Central-directory sizes also support archives with local data descriptors.
  let end = bytes.length - 22;
  while (end >= Math.max(0, bytes.length - 65557) && bytes.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error("Missing ZIP directory");
  let pos = bytes.readUInt32LE(end + 16);
  const entries = bytes.readUInt16LE(end + 10), candidates = [];
  for (let i = 0; i < entries; i++) {
    if (bytes.readUInt32LE(pos) !== 0x02014b50) throw new Error("Invalid ZIP entry");
    const method = bytes.readUInt16LE(pos + 10), size = bytes.readUInt32LE(pos + 20);
    const nameLength = bytes.readUInt16LE(pos + 28), extraLength = bytes.readUInt16LE(pos + 30);
    const commentLength = bytes.readUInt16LE(pos + 32), offset = bytes.readUInt32LE(pos + 42);
    const name = bytes.subarray(pos + 46, pos + 46 + nameLength).toString();
    if (name.endsWith(".json")) {
      const start = offset + 30 + bytes.readUInt16LE(offset + 26) + bytes.readUInt16LE(offset + 28);
      const compressed = bytes.subarray(start, start + size);
      const content = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed, { maxOutputLength: 50000000 }) : null;
      if (!content) throw new Error("Unsupported ZIP method");
      candidates.push({ name, content });
    }
    pos += 46 + nameLength + extraLength + commentLength;
  }
  if (candidates.length !== 1) throw new Error(`Expected one reference JSON, got ${candidates.length}`);
  report.referenceArchiveEntry = { name: candidates[0].name, sha256: sha(candidates[0].content) };
  return JSON.parse(candidates[0].content);
}

const manifestUrl = "https://hras.yseq.net/data/manifest";
const before = (await fetchBytes(manifestUrl)).toString();
report.manifest = Object.fromEntries(before.split(/\r?\n/).map((line) => {
  const comma = line.indexOf(","); return [line.slice(0, comma), line.slice(comma + 1)];
}));
if (report.manifest["YFull-version"] !== data.treeVersion || report.manifest.computedDate !== data.computedDate) {
  throw new Error("Current HRAS marker differs from local snapshot; do not claim identical source version");
}
const referenceUrl = `https://raw.githubusercontent.com/YFullTeam/YTree/master/ytree/tree_${encodeURIComponent(data.treeOfficialVersion)}.zip`;
const referenceRoot = unzipJson(await fetchBytes(referenceUrl));
const reference = new Map(), stack = [[referenceRoot, null]];
while (stack.length) {
  const [entry, parent] = stack.pop();
  if (!entry || typeof entry !== "object") continue;
  const id = typeof entry.id === "string" ? entry.id.trim() : "";
  if (id) {
    if (reference.has(id)) throw new Error("Duplicate reference node");
    const raw = entry.formed;
    reference.set(id, { parent, age: raw === null || raw === undefined || raw === "-" || raw === "" ? null : Number(raw) });
  }
  for (const child of entry.children ?? []) stack.push([child, id || parent]);
}
const local = new Map(data.nodeIds.map((id, i) => [id, i])), sourceCounts = new Map(), recordIds = new Map();
const hrasNodes = new Map();
let next = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (next < projects.length) {
    const project = projects[next++], base = `https://hras.yseq.net/data/haplogroups/y/${project}/${project}`;
    const [sampleBytes, treeBytes] = await Promise.all([fetchBytes(`${base}-samples.txt`), fetchBytes(`${base}-lessoutliers-tree.txt`)]);
    for (const line of sampleBytes.toString().split(/\r?\n/).map((x) => x.trim()).filter(Boolean)) {
      const comma = line.indexOf(",");
      if (comma < 1) { report.recordCounts.malformedLines++; continue; }
      const clade = line.slice(0, comma);
      for (const raw of line.slice(comma + 1).split(":")) {
        if (!raw.trim()) continue;
        report.recordCounts.raw++;
        const fields = raw.trim().split(/\s+/);
        if (fields.length < 5) { report.recordCounts.shortFields++; continue; }
        const country = fields[4].toUpperCase();
        if (country.length < 2 || country.length > 3) { report.recordCounts.invalidCountryLength++; continue; }
        report.recordCounts.accepted++;
        const assignment = `${clade}\t${country}`;
        if (recordIds.has(fields[0])) {
          report.recordCounts.duplicateRecordIds++;
          if (recordIds.get(fields[0]) !== assignment) report.recordCounts.duplicateIdDifferentAssignment++;
        }
        recordIds.set(fields[0], assignment);
        if (!local.has(clade)) report.recordCounts.acceptedMissingLocalClade++;
        sourceCounts.set(assignment, (sourceCounts.get(assignment) ?? 0) + 1);
      }
    }
    const ancestry = [];
    for (const match of treeBytes.toString().matchAll(/<\/?branch\b[^>]*>/g)) {
      const tag = match[0];
      if (tag.startsWith("</")) { ancestry.pop(); continue; }
      const attrs = Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
      if (!attrs.name) throw new Error("Unnamed HRAS node");
      hrasNodes.set(attrs.name, { parent: ancestry.at(-1) ?? null, age: attrs.formed ? Number(attrs.formed) : null });
      if (!tag.endsWith("/>")) ancestry.push(attrs.name);
    }
  }
}));
report.manifestStableDuringRead = (await fetchBytes(manifestUrl)).toString() === before;
const localCounts = new Map(data.samples.map(([n, c, count]) => [`${data.nodeIds[n]}\t${data.countryCodes[c]}`, count]));
report.aggregateMismatches = [...new Set([...sourceCounts.keys(), ...localCounts.keys()])]
  .filter((key) => sourceCounts.get(key) !== localCounts.get(key)).length;
const structure = { referenceNodes: reference.size, hrasNodes: hrasNodes.size,
  referenceMissingLocally: 0, referenceParentMismatch: 0, referenceAgeMismatch: 0,
  fallbackNodes: 0, fallbackMismatch: 0, nullRootWouldBeOverridden: 0, invertedEdges: 0, tiedDatedEdges: 0,
  localRoots: 0, localUnknownNull: 0, localUnknownZero: 0 };
for (const [id, node] of reference) {
  if (!local.has(id)) { structure.referenceMissingLocally++; continue; }
  const [, p, age] = data.nodes[local.get(id)];
  if ((p < 0 ? null : data.nodeIds[p]) !== node.parent) structure.referenceParentMismatch++;
  if (age !== node.age) structure.referenceAgeMismatch++;
  if (node.parent === null && hrasNodes.get(id)?.parent) structure.nullRootWouldBeOverridden++;
}
for (let i = 0; i < data.nodes.length; i++) {
  const [, p, age] = data.nodes[i];
  if (p < 0) structure.localRoots++;
  if (age === null) structure.localUnknownNull++;
  if (age === 0) structure.localUnknownZero++;
  if (p >= 0 && age > 0 && data.nodes[p][2] > 0) {
    if (age > data.nodes[p][2]) structure.invertedEdges++;
    if (age === data.nodes[p][2]) structure.tiedDatedEdges++;
  }
  if (!reference.has(data.nodeIds[i])) {
    structure.fallbackNodes++;
    const h = hrasNodes.get(data.nodeIds[i]);
    if (!h || h.age !== age || h.parent !== (p < 0 ? null : data.nodeIds[p])) structure.fallbackMismatch++;
  }
}
report.structure = structure;
report.manifestMinusRawRecords = Number(report.manifest.samples) - report.recordCounts.raw;
report.manifestMinusAcceptedRecords = Number(report.manifest.samples) - report.recordCounts.accepted;
report.sources.sort((a, b) => a.url.localeCompare(b.url));
const output = process.env.SEMANTIC_SOURCE_REPORT ?? path.join(root, "output/semantic-source-audit.json");
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ ...report, sources: `${report.sources.length} hashes recorded` }));
if (!report.manifestStableDuringRead || report.aggregateMismatches || structure.referenceMissingLocally ||
  structure.referenceParentMismatch || structure.referenceAgeMismatch || structure.fallbackMismatch) process.exitCode = 1;
