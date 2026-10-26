import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { runtime, removeTemporaryDirectory } from "./semantic-audit/runtime.mjs";
import { referenceQuery } from "./semantic-audit/reference.mjs";
import { checkQuery, checkProfile, formedRows, crossingRows } from "./semantic-audit/compare.mjs";
import { checkCsv } from "./semantic-audit/csv.mjs";
import { checkMutations } from "./semantic-audit/mutations.mjs";
import { compact, query, handCases, parentVectors, combinations, random, generatedForest } from "./semantic-audit/fixtures.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temp = path.join(root, "tmp", `semantic-audit-${process.pid}-${Date.now()}`);
const reportFile = process.env.SEMANTIC_AUDIT_REPORT;
const started = Date.now(), report = { startedAt: new Date().toISOString(), node: process.version,
  seed: 22092026, checks: {}, assumptions: ["0 and null mean unknown source age", "aggregated records are additive; person-level deduplication is upstream"], failures: [] };
let context = "initialization";
try {
  const api = await runtime(root, temp);
  for (const test of handCases()) {
    context = test.name;
    api.resetSliceAnalysisCaches();
    const result = checkQuery(api, test.data, test.q);
    checkCsv(api, test.q, result.actual, result.expected);
    for (const id of test.data.nodeIds) checkProfile(api, test.data, id);
  }
  // Hard-coded, hand-calculated answers also audit the reference model itself.
  const first = handCases()[0], expected = referenceQuery(first.data, first.q);
  assert.equal(expected.formed.length, 1);
  assert.equal(expected.formed[0].total, 17);
  assert.deepEqual(expected.formed[0].counts, [["AAA", 5], ["BBB", 12]]);
  assert.deepEqual(expected.formed[0].members.map((m) => m.id), ["SYN-000", "SYN-001", "SYN-002"]);
  assert.equal(expected.formedSupport, 17);
  assert.equal(referenceQuery(handCases()[1].data, query()).formed.length, 2);
  assert.equal(referenceQuery(handCases()[5].data, query()).crossing[0].total, 4);
  const outside = handCases().find(test => test.name === "density-outside-empty-search-window");
  const outsideResult = referenceQuery(outside.data, outside.q);
  assert.deepEqual(outsideResult.formed, []);
  assert.deepEqual(outsideResult.density.map(row => row.id), []);
  const intervals = handCases().find(test => test.name === "density-distinct-interval-country-pools");
  assert.deepEqual(referenceQuery(intervals.data, intervals.q).density.map(row => row.id), []);
  report.checks.handCases = handCases().length;
  report.checks.csvCases = handCases().length;
  console.log("Hand calculations: passed");

  let exhaustive = 0;
  for (const parents of parentVectors(3)) for (const ages of combinations([null, 0, 1, 2], 3)) {
    for (const assignments of [ [[0, 0, 1], [1, 1, 2], [2, 0, 3]], [[2, 0, 1], [2, 1, 1]] ]) {
      const data = compact(parents, ages, assignments, `enumerated-${exhaustive}`);
      api.resetSliceAnalysisCaches();
      const index = api.buildIndex(data);
      for (const target of [0, 1, 2, 3]) for (const window of [0, 1]) for (const min of [0, 2, 4]) for (const mode of ["any", "all"]) {
        context = `enumerated-${exhaustive}: ${JSON.stringify({ parents, ages, assignments, target, window, min, mode })}`;
        checkQuery(api, data, query({ target, maxDeltaYbp: window, minSamples: min, presenceMode: mode }), index);
        exhaustive++;
      }
    }
  }
  report.checks.boundedExhaustiveQueries = exhaustive;
  console.log(`Bounded enumeration: ${exhaustive} queries passed`);
  let generated = 0, profiles = 0, properties = 0;
  const rng = random(report.seed);
  for (let run = 0; run < 250; run++) {
    const data = generatedForest(rng, `generated-${run}`);
    api.resetSliceAnalysisCaches();
    const index = api.buildIndex(data);
    for (const id of data.nodeIds) { context = `profile-${run}-${id}`; checkProfile(api, data, id, index); profiles++; }
    for (let q = 0; q < 8; q++) {
      const input = query({ target: rng(10), maxDeltaYbp: rng(5), minSamples: rng(9),
        presenceMode: rng(2) ? "all" : "any", selectedCountries: data.countryCodes.filter(() => rng(2)) });
      context = `generated-${run}-${q}`;
      const { actual, expected } = checkQuery(api, data, input, index);
      checkCsv(api, input, actual, expected);
      report.checks.csvCases++;
      generated++;
      // Same evidence split into extra aggregate tuples and presented in reverse order.
      const transformed = { ...data, samples: data.samples.flatMap(([n, c, count]) =>
        count > 1 ? [[n, c, 1], [n, c, count - 1]] : [[n, c, count]]).reverse() };
      api.resetSliceAnalysisCaches();
      const transformedResult = checkQuery(api, transformed,
        { ...input, selectedCountries: [...input.selectedCountries].reverse() }).actual;
      assert.deepEqual(formedRows(transformedResult.formed.rows), formedRows(actual.formed.rows));
      assert.deepEqual(crossingRows(transformedResult.crossing.rows), crossingRows(actual.crossing.rows));
      properties++;
      // In all-branches mode wider windows cannot remove candidate IDs. In common
      // mode the wider cohort can activate another required country, so recheck its oracle.
      const wide = api.collectTimeMatchResults(index, { ...input, maxDeltaYbp: input.maxDeltaYbp + 2 });
      const ids = (result) => new Set(result.formed.rows.flatMap((r) => r.formedEvents.flatMap((e) => e.formedMembers.map((m) => m.node.id))));
      if (input.presenceMode === "any") {
        for (const id of ids(actual)) assert.ok(ids(wide).has(id), "wider window lost covered node");
      } else checkQuery(api, data, { ...input, maxDeltaYbp: input.maxDeltaYbp + 2 }, index);
      properties++;
    }
  }
  report.checks.generatedQueries = generated;
  report.checks.syntheticProfiles = profiles;
  report.checks.metamorphicComparisons = properties;
  console.log(`Generated forests: ${generated} queries, ${profiles} profiles, ${properties} properties passed`);
  context = "calendar";
  for (let ybp = 0; ybp <= 12000; ybp++) {
    const year = ybp <= 1949 ? 1950 - ybp : 1949 - ybp;
    assert.equal(api.ybpToCalendarYear(ybp), year);
    assert.equal(api.calendarYearToYbp(year), ybp);
  }
  assert.throws(() => api.calendarYearToYbp(0));
  report.checks.calendarRoundTrips = 12001;

  if (!process.argv.includes("--synthetic-only")) {
    const buffer = await fs.readFile(path.join(root, "public/data/hras-index.json"));
    const data = JSON.parse(buffer), index = api.buildIndex(data);
    report.dataSha256 = createHash("sha256").update(buffer).digest("hex");
    api.resetSliceAnalysisCaches();
    let real = 0;
    for (const selectedCountries of [["RUS"], ["RUS", "POL", "UKR"], ["CHN", "JPN"], data.countryCodes]) {
      for (const target of [1, 1949, 1950, 4850, 8000, 300000]) for (const presenceMode of ["any", "all"]) {
        const input = query({ selectedCountries, target, presenceMode,
          maxDeltaYbp: target === 300000 ? 300000 : 300, minSamples: real % 3 === 0 ? 5 : 0 });
        context = `real-${real}`;
        checkQuery(api, data, input, index);
        real++;
      }
    }
    report.checks.realSnapshotQueries = real;
    console.log(`Real snapshot: ${real} exact comparisons passed`);
  }
  if (process.argv.includes("--mutations")) {
    context = "targeted mutation campaign";
    report.mutations = await checkMutations(root, path.join(temp, "mutations"));
    assert.ok(report.mutations.every((m) => m.status === "detected"), "undetected intentional fault");
    console.log(`Targeted mutations: ${report.mutations.length} detected`);
  }
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failures.push({ context, message: error.message });
  console.error(context, error);
  process.exitCode = 1;
} finally {
  report.durationMs = Date.now() - started;
  if (reportFile) { await fs.mkdir(path.dirname(reportFile), { recursive: true }); await fs.writeFile(reportFile, JSON.stringify(report, null, 2) + "\n"); }
  await removeTemporaryDirectory(root, temp);
  console.log(JSON.stringify(report));
}
