import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSourceSnapshot, writeIndexAtomically } from "./data-snapshot.mjs";

const manifestUrl = "https://fixture.invalid/manifest";
const dataUrl = "https://fixture.invalid/SYN-samples.txt";
const commit = "a".repeat(40);
const sourceText = "SYN-TEST:synthetic,country,only";
const hash = text => createHash("sha256").update(text).digest("hex");

function sourceFixture({ changeManifest = false, changeManifestAt = 2, changeData = false } = {}) {
  const requests = [];
  const counts = new Map();
  return {
    requests,
    fetchImpl: async url => {
      requests.push(url);
      const count = (counts.get(url) ?? 0) + 1;
      counts.set(url, count);
      if (url.includes("api.github.com")) {
        return new Response(JSON.stringify({ object: { type: "commit", sha: commit } }));
      }
      if (url === manifestUrl) return new Response(changeManifest && count >= changeManifestAt ? "v2" : "v1");
      if (url === dataUrl) return new Response(changeData && count > 1 ? `${sourceText}\nSYN-NEW` : sourceText);
      assert.ok(url.includes(`/${commit}/`), "reference inputs must use the immutable commit URL");
      return new Response(url.endsWith("current_version.txt") ? "SYN-v1" : '{"id":"SYN-ROOT"}');
    },
  };
}

async function load(snapshot) {
  const root = await snapshot.pinReference("SyntheticOwner", "SyntheticTree");
  await snapshot.read(`${root}current_version.txt`);
  await snapshot.read(`${root}current_tree.json`);
  await snapshot.read(manifestUrl, { verify: true });
  await snapshot.read(dataUrl, { verify: true });
}

const fixture = sourceFixture();
const snapshot = createSourceSnapshot(fixture);
await load(snapshot);
assert.throws(() => snapshot.metadata(), /unverified/);
await snapshot.verify(manifestUrl);
const metadata = snapshot.metadata();
assert.equal(metadata.referenceCommit, commit);
assert.equal(metadata.files.length, 5);
assert.equal(metadata.files.find(file => file.url === dataUrl).sha256, hash(sourceText));
assert.equal(metadata.files.find(file => file.url === dataUrl).bytes, Buffer.byteLength(sourceText));
assert.equal(fixture.requests.filter(url => url === manifestUrl).length, 3);
assert.equal(fixture.requests.filter(url => url === dataUrl).length, 2);
assert.ok(!JSON.stringify(metadata).includes(sourceText), "provenance must never retain sample content");
await assert.rejects(snapshot.read("https://fixture.invalid/new"), /before verification/);

const replayFixture = sourceFixture();
const replay = createSourceSnapshot({ ...replayFixture, expectedSnapshot: metadata });
await load(replay);
await replay.verify(manifestUrl);
assert.equal(replay.metadata().referenceResolution, "source-lock");
assert.ok(!replayFixture.requests.some(url => url.includes("api.github.com")), "replay must ignore the moving branch head");
const changedLock = structuredClone(metadata);
changedLock.files.find(file => file.url === dataUrl).sha256 = "b".repeat(64);
await assert.rejects(load(createSourceSnapshot({ ...sourceFixture(), expectedSnapshot: changedLock })), /no longer matches lock/);
assert.throws(() => createSourceSnapshot({ expectedSnapshot: { ...metadata, referenceCommit: "master" } }), /Invalid source lock/);

const directory = await mkdtemp(join(tmpdir(), "ynodus-snapshot-test-"));
const indexPath = join(directory, "index.json");
try {
  const previous = '{"synthetic":"previous"}\n';
  await writeFile(indexPath, previous);
  for (const change of [{ changeManifest: true }, { changeManifest: true, changeManifestAt: 3 }, { changeData: true }]) {
    const changed = createSourceSnapshot(sourceFixture(change));
    await load(changed);
    await assert.rejects(async () => {
      await changed.verify(manifestUrl);
      await writeIndexAtomically(indexPath, { inputSnapshot: changed.metadata() });
    }, /Source changed during build/);
    assert.equal(await readFile(indexPath, "utf8"), previous);
    assert.throws(() => changed.metadata(), /unverified/);
  }
  const cyclic = {};
  cyclic.self = cyclic;
  await assert.rejects(writeIndexAtomically(indexPath, cyclic), /circular/i);
  assert.equal(await readFile(indexPath, "utf8"), previous);
  assert.deepEqual(await readdir(directory), ["index.json"]);
  await writeIndexAtomically(indexPath, { inputSnapshot: metadata });
  assert.deepEqual(JSON.parse(await readFile(indexPath, "utf8")).inputSnapshot, metadata);
  assert.deepEqual(await readdir(directory), ["index.json"]);
} finally {
  await rm(directory, { recursive: true, force: true });
}

const oversized = createSourceSnapshot({ maxBytes: 3, fetchImpl: async () => new Response("four") });
await assert.rejects(oversized.read(dataUrl), /Source exceeds 3 bytes/);
const unavailable = createSourceSnapshot({ fetchImpl: async () => new Response("SYN-private-body", { status: 503 }) });
await assert.rejects(unavailable.read(dataUrl), error => /HTTP 503/.test(error.message) && !error.message.includes("private-body"));
const badCommit = createSourceSnapshot({ fetchImpl: async () => new Response('{"object":{"type":"commit","sha":"master"}}') });
await assert.rejects(badCommit.pinReference("SyntheticOwner", "SyntheticTree"), /missing or invalid/);
const slow = createSourceSnapshot({ timeoutMs: 10, fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
  signal.addEventListener("abort", () => reject(new Error("Synthetic request aborted")), { once: true });
}) });
await assert.rejects(slow.read(dataUrl), /aborted/);
console.log("Source snapshot contracts passed: immutable reference, stable mutable inputs, bounded fetch and atomic publication.");
