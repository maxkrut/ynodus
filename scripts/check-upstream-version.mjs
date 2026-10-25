import { appendFile, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { assessHrasManifest } from "./build-hras-index.mjs";

const DATA_ROOT = "https://hras.yseq.net/data/";
const MANIFEST_URL = `${DATA_ROOT}manifest`;
const REFERENCE_OWNER = `Y${"Full"}Team`;
const REFERENCE_REPO = "YTree";
const REFERENCE_VERSION_URL =
  `https://raw.githubusercontent.com/${REFERENCE_OWNER}/${REFERENCE_REPO}/master/current_version.txt`;
const MANIFEST_TREE_VERSION_KEY = `Y${"Full"}-version`;
const LOCAL_INDEX = "public/data/hras-index.json";
const REQUEST_HEADERS = {
  "User-Agent": "yNodus/1.2.0",
  Accept: "text/plain,*/*",
};

if (isMainModule()) await main();

async function main() {
  const [manifestText, referenceMarker, localIndex] = await Promise.all([
    fetchText(MANIFEST_URL),
    fetchOptionalText(REFERENCE_VERSION_URL),
    readLocalIndex(),
  ]);

  const manifest = parseManifest(manifestText);
  const hrasManifest = assessHrasManifest(manifest);
  const remote = {
    treeVersion: hrasManifest.treeVersion,
    computedDate: hrasManifest.computedDate,
    manifestSampleCount: hrasManifest.manifestSampleCount,
    officialTreeVersion: referenceMarker.value.trim(),
  };
  const status = assessUpstreamChange(
    localIndex,
    remote,
    referenceMarker.available,
    !hrasManifest.degraded,
  );
  const summary = [
    `HRAS tree version: ${localIndex.treeVersion ?? "unknown"} -> ${remote.treeVersion}`,
    `HRAS computedDate: ${localIndex.computedDate ?? "unknown"} -> ${remote.computedDate || "unknown"}`,
    `HRAS manifest samples: ${localIndex.hrasManifestSampleCount ?? "unknown"} -> ${remote.manifestSampleCount ?? "unknown"}`,
    `Official reference marker: ${localIndex.treeOfficialVersion ?? "unknown"} -> ${status.remoteOfficialTreeVersion ?? "unavailable"}`,
  ].join("\n");

  console.log(summary);
  console.log(status.changed
    ? `Known upstream change detected: ${changeLabels(status).join(", ")}.`
    : "No known upstream change detected.");
  if (status.degraded) {
    console.warn(
      `Upstream provenance check degraded; generated-index rebuild must remain blocked${[
        hrasManifest.warning,
        referenceMarker.error,
      ].filter(Boolean).length ? `: ${[hrasManifest.warning, referenceMarker.error].filter(Boolean).join(" ")}` : "."}`,
    );
  }

  await setOutput("changed", String(status.changed));
  await setOutput("degraded", String(status.degraded));
  await setOutput("hras_changed", String(status.hrasChanged));
  await setOutput("reference_changed", String(status.referenceChanged));
  await setOutput("tree_version", remote.treeVersion);
  await setOutput("computed_date", remote.computedDate);
  await setOutput("manifest_sample_count", remote.manifestSampleCount ?? "");
  await setOutput("official_tree_version", status.remoteOfficialTreeVersion ?? "unknown");
  await setOutput("summary", summary);
}

export function assessUpstreamChange(
  localIndex,
  remote,
  referenceMarkerAvailable = true,
  hrasMetadataAvailable = true,
) {
  const remoteOfficialTreeVersion = knownMarker(remote.officialTreeVersion);
  const degraded = !hrasMetadataAvailable || !referenceMarkerAvailable || remoteOfficialTreeVersion === null;
  const hrasChanged =
    remote.treeVersion !== localIndex.treeVersion ||
    remote.computedDate !== localIndex.computedDate ||
    remote.manifestSampleCount !== localIndex.hrasManifestSampleCount;
  const referenceChanged =
    !degraded && remoteOfficialTreeVersion !== knownMarker(localIndex.treeOfficialVersion);

  return {
    changed: hrasChanged || referenceChanged,
    degraded,
    hrasChanged,
    referenceChanged,
    remoteOfficialTreeVersion,
  };
}

function knownMarker(value) {
  if (typeof value !== "string") return null;
  const marker = value.trim();
  return marker && marker.toLowerCase() !== "unknown" ? marker : null;
}

function changeLabels(status) {
  const labels = [];
  if (status.hrasChanged) labels.push("HRAS manifest");
  if (status.referenceChanged) labels.push("official reference marker");
  return labels;
}

function isMainModule() {
  return Boolean(process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url);
}

async function readLocalIndex() {
  try {
    return JSON.parse(await readFile(LOCAL_INDEX, "utf8"));
  } catch {
    return {};
  }
}

async function fetchText(url) {
  const response = await fetch(url, { headers: REQUEST_HEADERS });
  if (!response.ok) {
    throw new Error(`Could not fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function fetchOptionalText(url) {
  try {
    return { available: true, value: await fetchText(url), error: null };
  } catch (error) {
    return {
      available: false,
      value: "unknown",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function parseManifest(text) {
  const result = {};
  for (const line of text.trim().split(/\r?\n/)) {
    const [key, ...rest] = line.split(",");
    if (key) result[key] = rest.join(",");
  }
  return result;
}

async function setOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  const delimiter = `EOF_${name}_${Date.now()}`;
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `${name}<<${delimiter}\n${String(value)}\n${delimiter}\n`,
    "utf8",
  );
}
