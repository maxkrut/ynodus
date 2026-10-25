import assert from "node:assert/strict";
import fs from "node:fs";
import {
  assessHrasManifest,
  assessReferenceMarker,
  mergeNodes,
} from "./build-hras-index.mjs";
import { assessUpstreamChange } from "./check-upstream-version.mjs";
import "./test-data-snapshot.mjs";
import "./test-runtime-format-migration.mjs";

const local = {
  treeVersion: "v14.03.00",
  computedDate: "Jun 14 2026",
  hrasManifestSampleCount: 48_724,
  treeOfficialVersion: "14.04.0",
};
const sameRemote = {
  treeVersion: local.treeVersion,
  computedDate: local.computedDate,
  manifestSampleCount: local.hrasManifestSampleCount,
  officialTreeVersion: local.treeOfficialVersion,
};

assert.deepEqual(
  assessHrasManifest({
    "YFull-version": " v14.03.00 ",
    computedDate: "Jun 14 2026",
    samples: "48724",
  }),
  {
    treeVersion: "v14.03.00",
    computedDate: "Jun 14 2026",
    manifestSampleCount: 48_724,
    degraded: false,
    warning: null,
  },
);
for (const malformedManifest of [
  { "YFull-version": "unknown", computedDate: "Jun 14 2026", samples: "48724" },
  { "YFull-version": "v14.03.00", computedDate: "not-a-date", samples: "48724" },
  { "YFull-version": "v14.03.00", computedDate: "Jun 14 2026", samples: "0" },
  { "YFull-version": "v14.03.00", computedDate: "Jun 14 2026", samples: null },
]) {
  const assessment = assessHrasManifest(malformedManifest);
  assert.equal(assessment.degraded, true);
  assert.match(assessment.warning, /cannot be built reproducibly/);
}

assert.deepEqual(assessUpstreamChange(local, sameRemote), {
  changed: false,
  degraded: false,
  hrasChanged: false,
  referenceChanged: false,
  remoteOfficialTreeVersion: "14.04.0",
});

assert.deepEqual(
  assessUpstreamChange(local, { ...sameRemote, officialTreeVersion: "14.05.0" }),
  {
    changed: true,
    degraded: false,
    hrasChanged: false,
    referenceChanged: true,
    remoteOfficialTreeVersion: "14.05.0",
  },
);

assert.deepEqual(
  assessUpstreamChange(local, { ...sameRemote, officialTreeVersion: "unknown" }, false),
  {
    changed: false,
    degraded: true,
    hrasChanged: false,
    referenceChanged: false,
    remoteOfficialTreeVersion: null,
  },
);

assert.deepEqual(
  assessUpstreamChange(local, sameRemote, true, false),
  {
    changed: false,
    degraded: true,
    hrasChanged: false,
    referenceChanged: false,
    remoteOfficialTreeVersion: "14.04.0",
  },
  "an invalid HRAS manifest must block rebuilds even when the reference marker is available",
);

assert.deepEqual(
  assessUpstreamChange(
    local,
    {
      ...sameRemote,
      computedDate: "Jul 01 2026",
      officialTreeVersion: "unknown",
    },
    false,
  ),
  {
    changed: true,
    degraded: true,
    hrasChanged: true,
    referenceChanged: false,
    remoteOfficialTreeVersion: null,
  },
);

assert.deepEqual(
  assessReferenceMarker({ available: true, value: " 14.04.0\n", error: null }),
  { value: "14.04.0", degraded: false, warning: null },
);
const degradedMarker = assessReferenceMarker({
  available: false,
  value: "unknown",
  error: "synthetic fetch failure",
});
assert.equal(degradedMarker.value, "unknown");
assert.equal(degradedMarker.degraded, true);
assert.match(degradedMarker.warning, /cannot be built reproducibly/);

const syntheticRoot = {
  id: "SYN-ROOT",
  project: "SYN",
  parent: null,
  formed: 6_000,
};
const syntheticChild = {
  id: "SYN-CHILD",
  project: "SYN",
  parent: syntheticRoot.id,
  formed: 5_000,
};
assert.equal(
  mergeNodes(
    { [syntheticRoot.id]: syntheticRoot, [syntheticChild.id]: syntheticChild },
    { [syntheticChild.id]: { ...syntheticChild, parent: null } },
  )[syntheticChild.id].parent,
  null,
  "an explicit reference root must not acquire an HRAS fallback parent",
);
assert.equal(
  mergeNodes(
    { [syntheticRoot.id]: syntheticRoot, [syntheticChild.id]: syntheticChild },
    {},
  )[syntheticChild.id].parent,
  syntheticRoot.id,
);
assert.throws(
  () => mergeNodes(
    {
      [syntheticChild.id]: {
        ...syntheticChild,
        parent: "SYN-MISSING",
      },
    },
    {},
  ),
  /Merged node SYN-CHILD references missing parent SYN-MISSING/,
  "missing source parents must fail closed instead of creating synthetic roots",
);

const updateWorkflow = fs.readFileSync(".github/workflows/update-data.yml", "utf8");
const buildWorkflow = fs.readFileSync(".github/workflows/build.yml", "utf8");
for (const workflow of [updateWorkflow, buildWorkflow]) {
  assert.match(workflow, /actions\/checkout@v7/);
  assert.match(workflow, /actions\/setup-node@v7/);
  assert.doesNotMatch(workflow, /actions\/(?:checkout|setup-node)@v[1-6]\b/);
}
for (const stepName of [
  "Rebuild data index",
  "Validate generated data and contracts",
  "Validate production build",
  "Check generated diff",
  "Create or update pull request",
]) {
  const stepStart = updateWorkflow.indexOf(`- name: ${stepName}`);
  assert.ok(stepStart >= 0, `missing update-data workflow step: ${stepName}`);
  const nextStep = updateWorkflow.indexOf("\n      - name:", stepStart + 1);
  const step = updateWorkflow.slice(stepStart, nextStep < 0 ? undefined : nextStep);
  assert.match(
    step,
    /steps\.upstream\.outputs\.degraded != 'true'/,
    `${stepName} must fail closed while the official reference marker is degraded`,
  );
}

console.log("Data provenance test passed: degraded markers block rebuilds, reference changes trigger, and missing parents fail closed.");
