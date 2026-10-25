import path from "node:path";
import { runtime, removeTemporaryDirectory } from "./runtime.mjs";
import { checkQuery, checkProfile } from "./compare.mjs";
import { handCases } from "./fixtures.mjs";

const mutations = [
  { name: "Every country minimum is ignored", file: "src/shared/country-matching.ts",
    before: "(counts.get(code) ?? 0) >= threshold", after: "(counts.get(code) ?? 0) >= 1" },
  { name: "Formed excludes inclusive boundary", file: "src/worker/slice-analysis/evidence.ts",
    before: "node.formed >= target - maxDeltaYbp", after: "node.formed > target - maxDeltaYbp" },
  { name: "Crossing excludes inclusive boundary", file: "src/worker/slice-analysis/evidence.ts",
    before: "target >= younger && target <= older", after: "target > younger && target < older" },
  { name: "Crossing mishandles inverted dates", file: "src/worker/slice-analysis/evidence.ts",
    before: "const younger = Math.min(parent.formed, child.formed);", after: "const younger = child.formed;" },
  { name: "Any replaces Every", file: "src/shared/country-matching.ts",
    before: "matchingCodes.every(code", after: "matchingCodes.some(code" },
  { name: "Double counts aggregate evidence", file: "src/worker/slice-analysis/formed-groups.ts",
    before: "row.total += sample.count;", after: "row.total += 2 * sample.count;" },
  { name: "Merges different ages into same event", file: "src/worker/slice-analysis/formed-groups.ts",
    before: "if (!parent || parent.node.formed !== row.node.formed) break;", after: "if (!parent) break;" },
  { name: "Skips immediate parent in event assembly", file: "src/worker/slice-analysis/formed-groups.ts",
    before: "const parentId = current.path.at(-2)?.id;", after: "const parentId = current.path.at(-3)?.id;" },
  { name: "Requires both endpoints to hide Crossing", file: "src/worker/slice-analysis.ts",
    before: "coveredNodeIds.has(row.node.id) || coveredNodeIds.has(childId)",
    after: "coveredNodeIds.has(row.node.id) && coveredNodeIds.has(childId)" },
  { name: "Strict minimum instead of inclusive", file: "src/shared/country-matching.ts",
    before: "(counts.get(code) ?? 0) >= threshold", after: "(counts.get(code) ?? 0) > threshold" },
  { name: "Profile direct evidence counted twice", file: "src/worker/evidence-profile.ts",
    before: "current.directTotal += record.count;", after: "current.directTotal += record.count * 2;" },
  { name: "Calendar permits astronomical zero", file: "src/shared/time.ts",
    before: "astronomicalYear - 1", after: "astronomicalYear" },
];

export async function checkMutations(root, outputDirectory) {
  const results = [];
  for (const [i, mutation] of mutations.entries()) {
    const directory = path.join(outputDirectory, `mutation-${i}`);
    try {
      const api = await runtime(root, directory, mutation);
      const tests = handCases();
      tests.push({ ...tests[0], name: "threshold-exactly-equal", q: { ...tests[0].q, minSamples: 5 } });
      const detections = [];
      for (const test of tests) {
        api.resetSliceAnalysisCaches();
        try {
          checkQuery(api, test.data, test.q);
          for (const id of test.data.nodeIds) checkProfile(api, test.data, id);
        } catch (error) {
          // Broken imports or runtime crashes do not count as evidence that an assertion detects a wrong answer.
          if (error.code !== "ERR_ASSERTION") throw error;
          detections.push(test.name);
        }
      }
      if (api.ybpToCalendarYear(1950) !== -1 || api.ybpToCalendarYear(1949) !== 1) detections.push("civil-calendar-boundary");
      results.push({ name: mutation.name, file: mutation.file, detectedBy: detections, status: detections.length ? "detected" : "survived" });
    } finally {
      await removeTemporaryDirectory(root, directory);
    }
  }
  return results;
}
