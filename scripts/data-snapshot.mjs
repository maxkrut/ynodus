import { createHash, randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

const HEADERS = { "User-Agent": "yNodus/1.1.0", Accept: "text/plain,*/*" };

// Hash only public input bytes. Never retain or log source sample identifiers.
export function createSourceSnapshot({ fetchImpl = fetch, timeoutMs = 60_000, maxBytes = 64 * 1024 * 1024, expectedSnapshot = null } = {}) {
  const files = new Map();
  let referenceCommit = null;
  let verifiedAt = null;
  let expected = null;
  if (expectedSnapshot) {
    if (expectedSnapshot.format !== "ynodus/source-snapshot-v1" || !/^[a-f0-9]{40}$/.test(expectedSnapshot.referenceCommit ?? "")
      || !Array.isArray(expectedSnapshot.files) || expectedSnapshot.files.length === 0) throw new Error("Invalid source lock");
    expected = new Map();
    for (const file of expectedSnapshot.files) {
      if (typeof file.url !== "string" || !/^[a-f0-9]{64}$/.test(file.sha256 ?? "")
        || !Number.isSafeInteger(file.bytes) || file.bytes < 0 || file.bytes > maxBytes || expected.has(file.url)) throw new Error("Invalid source lock file");
      expected.set(file.url, file);
    }
  }

  async function download(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { headers: HEADERS, signal: controller.signal });
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`Could not fetch ${url}: HTTP ${response.status}`);
      }
      const chunks = [];
      let bytes = 0;
      for await (const chunk of response.body) {
        bytes += chunk.byteLength;
        if (bytes > maxBytes) {
          controller.abort();
          throw new Error(`Source exceeds ${maxBytes} bytes: ${url}`);
        }
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      return { text: buffer.toString("utf8"), bytes, sha256: createHash("sha256").update(buffer).digest("hex") };
    } finally {
      clearTimeout(timer);
    }
  }

  async function read(url, { verify = false } = {}) {
    if (verifiedAt || files.has(url)) throw new Error("Snapshot inputs must be read once before verification");
    if (expected && !expected.has(url)) throw new Error(`Source is absent from lock: ${url}`);
    const value = await download(url);
    if (expected && (value.sha256 !== expected.get(url).sha256 || value.bytes !== expected.get(url).bytes)) {
      throw new Error(`Source no longer matches lock; existing index preserved: ${url}`);
    }
    files.set(url, { url, bytes: value.bytes, sha256: value.sha256, verify });
    return value.text;
  }

  async function pinReference(owner, repo, branch = "master") {
    if (referenceCommit) throw new Error("Reference commit is already pinned");
    if (expected) {
      referenceCommit = expectedSnapshot.referenceCommit;
      return `https://raw.githubusercontent.com/${owner}/${repo}/${referenceCommit}/`;
    }
    const text = await read(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`);
    let value;
    try { value = JSON.parse(text); } catch { throw new Error("Invalid reference commit response"); }
    if (value?.object?.type !== "commit" || !/^[a-f0-9]{40}$/.test(value?.object?.sha ?? "")) {
      throw new Error("Reference commit is missing or invalid");
    }
    referenceCommit = value.object.sha;
    return `https://raw.githubusercontent.com/${owner}/${repo}/${referenceCommit}/`;
  }

  async function verify(manifestUrl) {
    if (verifiedAt) throw new Error("Snapshot has already been verified");
    const manifest = files.get(manifestUrl);
    if (!manifest?.verify) throw new Error("A mutable manifest is required for verification");
    const mutable = [...files.values()].filter(file => file.verify);
    async function recheck(file) {
      const next = await download(file.url);
      if (next.sha256 !== file.sha256 || next.bytes !== file.bytes) {
        throw new Error(`Source changed during build; existing index preserved: ${file.url}`);
      }
    }
    let position = 0;
    // Wait for all owned requests even after a failure. No write can begin early.
    const results = await Promise.allSettled(Array.from({ length: 4 }, async () => {
      while (position < mutable.length) await recheck(mutable[position++]);
    }));
    const failure = results.find(result => result.status === "rejected");
    if (failure) throw failure.reason;
    await recheck(manifest);
    verifiedAt = new Date().toISOString();
  }

  function metadata() {
    if (!verifiedAt) throw new Error("Cannot publish an unverified source snapshot");
    return {
      format: "ynodus/source-snapshot-v1",
      referenceCommit,
      referenceResolution: expected ? "source-lock" : "github-branch-at-build-start",
      verification: "hras-inputs-identical-on-second-read-and-manifest-stable",
      verifiedAt,
      files: [...files.values()].sort((a, b) => a.url < b.url ? -1 : a.url > b.url ? 1 : 0)
        .map(({ verify: verifiedOnSecondRead, ...file }) => ({ ...file, verifiedOnSecondRead })),
    };
  }

  return { read, pinReference, verify, metadata };
}

export async function writeIndexAtomically(path, payload) {
  const directory = dirname(path);
  await mkdir(directory, { recursive: true });
  const temporary = join(directory, `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify(payload)}\n`, { encoding: "utf8", flag: "wx" });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}
