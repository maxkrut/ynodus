import { assertAncientScopes } from "./result-invariants/ancient-contracts.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "@typescript/typescript6";

import { assertCrossingNoveltyOnDefaultQuery } from "./result-invariants/crossing-contracts.mjs";
import { assertSyntheticSemantics } from "./result-invariants/synthetic-contracts.mjs";
import { assertCountryMinimum, eligibleCountries } from "./result-invariants/country-minimum-contracts.mjs";
import { assertResultNeighbors } from "./result-invariants/neighbor-contracts.mjs";
import { assertIntervalDensity } from "./result-invariants/density-interval-contracts.mjs";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEMP_ROOT = path.join(ROOT, "tmp", `.result-semantics-test-${process.pid}-${Date.now()}`);
const EXHAUSTIVE = process.argv.includes("--exhaustive");

try {
  await transpileDirectory("src/shared", "shared");
  await transpileDirectory("src/worker", "worker");
  const { buildIndex } = await import(pathToFileURL(path.join(TEMP_ROOT, "worker/index-builder.js")).href);
  const { countryEvidenceForBranch, countryOverviewForCountry, subcladeProfileForClade } = await import(
    pathToFileURL(path.join(TEMP_ROOT, "worker/evidence-profile.js")).href
  );
  const { collectRowsAtTarget, collectTimeMatchResults, formedCoverageNodeIds, crossingEdgeCoveredByFormed, resetSliceAnalysisCaches } = await import(
    pathToFileURL(path.join(TEMP_ROOT, "worker/slice-analysis.js")).href
  );

  const ancientDecorators = await import(pathToFileURL(path.join(TEMP_ROOT, "worker/ancient-evidence.js")).href);
  assertAncientScopes(buildIndex, collectTimeMatchResults, subcladeProfileForClade, countryOverviewForCountry, ancientDecorators);
  const compactIndex = JSON.parse(
    fs.readFileSync(path.join(ROOT, "public/data/hras-index.json"), "utf8"),
  );
  const index = buildIndex(compactIndex);
  const sourceParentById = compactParentMap(compactIndex);
  const presetScopes = readPresetScopes(index);
  const matrix = buildMatrix(presetScopes);
  const failures = [];

  resetSliceAnalysisCaches();
  for (const scenario of matrix) {
    try {
      const result = collectRowsAtTarget(index, scenario.input);
      assertAnalysisResult(index, sourceParentById, result, scenario, collectRowsAtTarget);
    } catch (error) {
      failures.push(`${scenario.label}: ${error instanceof Error ? error.message : String(error)}`);
      if (failures.length >= 20) break;
    }
  }

  try {
    assertCountryMinimum(buildIndex, collectRowsAtTarget, collectTimeMatchResults);
    const { densityIntervals } = await import(pathToFileURL(path.join(TEMP_ROOT, "shared/density-intervals.js")).href);
    const scale = { fullRange: true, maxFormedYbp: index.maxFormedYbp };
    assertIntervalDensity(buildIndex, collectRowsAtTarget, resetSliceAnalysisCaches, index,
      [densityIntervals(300, 20000, scale), densityIntervals(600, 20000, scale),
        densityIntervals(600, 20000, scale, 15900)]);
    assertResultNeighbors(buildIndex, collectRowsAtTarget, resetSliceAnalysisCaches);
    assertSyntheticSemantics(
      buildIndex,
      collectRowsAtTarget,
      collectTimeMatchResults,
      formedCoverageNodeIds,
      crossingEdgeCoveredByFormed,
      resetSliceAnalysisCaches,
      subcladeProfileForClade,
      countryEvidenceForBranch,
    );
  } catch (error) {
    failures.push(`synthetic semantics: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    assertCrossingNoveltyOnDefaultQuery(
      index,
      presetScopes,
      collectRowsAtTarget,
      collectTimeMatchResults,
      formedCoverageNodeIds,
      crossingEdgeCoveredByFormed,
    );
  } catch (error) {
    failures.push(`crossing novelty: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (failures.length > 0) {
    console.error(`Result semantics test failed: ${failures.length} failure(s).`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(
      `Result semantics test passed: ${matrix.length} preset-mode-presence scenario(s) across ${presetScopes.length} presets.`,
    );
  }
} finally {
  await fsPromises.rm(TEMP_ROOT, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

function readPresetScopes(index) {
  const presetDir = path.join(ROOT, "src", "presets");
  const files = fs.readdirSync(presetDir).filter((name) => name.endsWith(".json")).sort();
  assert.equal(files.length, 33, "the shipped preset matrix must include all 33 country presets");
  const presetPolicy = fs.readFileSync(path.join(ROOT, "src", "app", "presets.ts"), "utf8");
  assert.match(presetPolicy, /key\.startsWith\("arch-"\) \|\| COUNTRY_CODE_PROXY_KEYS\.has\(key\)[\s\S]*"country-code-proxy"/,
    "archaeological and ethnolinguistic labels must be classified as country-code proxies");
  for (const key of ["anglosphere", "arabic", "celtic", "finnoUgric", "iranian", "slavic", "turkic"]) {
    assert.match(presetPolicy, new RegExp(`"${key}"`), `${key}: cultural/linguistic shortcut must be in the proxy policy`);
  }
  assert.match(presetPolicy, /Archaeological themes/,
    "archaeological shortcuts must be presented as themes, not cultural sample sets");
  assert.match(presetPolicy, /Language themes/,
    "language shortcuts must be presented as themes, not sample identities");
  return files.map((fileName) => {
    const preset = JSON.parse(fs.readFileSync(path.join(presetDir, fileName), "utf8"));
    assert.equal(typeof preset.key, "string", `${fileName}: key`);
    assert.ok(Array.isArray(preset.countries) && preset.countries.length > 0, `${fileName}: countries`);
    assert.equal(
      new Set(preset.countries).size,
      preset.countries.length,
      `${fileName}: duplicate country code`,
    );
    const countries = preset.countries.filter((code) => index.countries.has(code));
    assert.ok(countries.length > 0, `${fileName}: no countries exist in the runtime index`);
    return { key: preset.key, countries };
  });
}

function buildMatrix(presets) {
  const targets = EXHAUSTIVE ? [700, 2200, 4850, 8000] : [5500];
  const deltas = EXHAUSTIVE ? [0, 300, 900] : [300];
  const matrix = [];
  for (const preset of presets) {
    for (const sliceMode of ["formed", "crossing"]) {
      for (const presenceMode of ["any", "all"]) {
        for (const target of targets) {
          for (const maxDeltaYbp of sliceMode === "formed" ? deltas : [300]) {
            const input = {
              target,
              selectedCountries: preset.countries,
              presenceMode,
              sliceMode,
              maxDeltaYbp,
              minSamples: 0,
              anchorId: null,
              scopeAllCountries: false,
              includeSuggestions: false,
            };
            matrix.push({
              label: `${preset.key}/${sliceMode}/${presenceMode}/target=${target}/delta=${maxDeltaYbp}`,
              input,
            });
          }
        }
      }
    }
  }
  return matrix;
}

function assertAnalysisResult(index, sourceParentById, result, scenario, collectRowsAtTarget) {
  assert.deepEqual(
    Object.keys(result).sort(),
    ["countryMinimumNotMet", "densityKey", "densityRows", "matchingSamples", "minSamples", "participatingCountries", "rows", "suggestions"],
    "AnalysisResult must contain only canonical rows, density, support, threshold, minimum status, and suggestions",
  );
  assert.equal(result.countryMinimumNotMet, scenario.input.presenceMode === "all"
    && scenario.input.selectedCountries.length > 0 && eligibleCountries(index, scenario.input).length === 0);
  assert.deepEqual(result.participatingCountries, [...eligibleCountries(index, scenario.input)].sort(),
    "the notice receives the same country pool that filters canonical events");
  assert.equal(result.minSamples, scenario.input.minSamples);
  assert.ok(Number.isSafeInteger(result.matchingSamples) && result.matchingSamples >= 0);
  assert.ok(Array.isArray(result.densityRows));
  assert.ok(typeof result.densityKey === "string" && result.densityKey.length > 0,
    "density context must have a stable evidence-scope identity");
  for (const row of result.densityRows) {
    assert.equal(
      row.parentId,
      sourceParentById.get(row.node.id),
      `density parent for ${row.node.id} must preserve the real source edge`,
    );
  }
  const retainedDensity = collectRowsAtTarget(index, {
    ...scenario.input,
    knownDensityKey: result.densityKey,
  });
  assert.equal(retainedDensity.densityRows, null,
    "a client retaining the same density scope must not receive the large payload again");
  assert.equal(retainedDensity.densityKey, result.densityKey);
  assert.equal(new Set(result.rows.map(resultIdentity)).size, result.rows.length, "duplicate result identity");

  const participating = eligibleCountries(index, scenario.input);
  for (let indexInRows = 0; indexInRows < result.rows.length; indexInRows += 1) {
    const row = result.rows[indexInRows];
    assertResultRow(index, sourceParentById, row, scenario.input, participating);
    if (indexInRows > 0) {
      assert.ok(compareRows(result.rows[indexInRows - 1], row) <= 0, "result ordering is unstable");
    }
  }

  const minFiltered = collectRowsAtTarget(index, {
    ...scenario.input,
    minSamples: Math.max(2, medianSupport(result.rows)),
  });
  const filteredInput = { ...scenario.input, minSamples: minFiltered.minSamples };
  const filteredCountries = eligibleCountries(index, filteredInput);
  for (const row of minFiltered.rows) {
    assertResultRow(index, sourceParentById, row, filteredInput, filteredCountries);
  }
}

function assertResultRow(index, sourceParentById, row, input, required) {
  assert.ok(row.countryCounts instanceof Map, "countryCounts must remain a Map over the worker wire");
  assert.ok(Number.isSafeInteger(row.total) && row.total > 0);
  assert.equal(row.total, [...row.countryCounts.values()].reduce((sum, count) => sum + count, 0));
  assert.ok(required.length > 0 && required.some(code => (row.countryCounts.get(code) ?? 0) > 0));
  assert.deepEqual([...(row.belowMinimumCountryCounts ?? [])].sort(),
    input.presenceMode === "any" ? [] : [...row.countryCounts].filter(([code]) => !required.includes(code)).sort());
  if (input.presenceMode === "all") assert.ok(required.every(code => (row.countryCounts.get(code) ?? 0) > 0));
  assert.ok(Array.isArray(row.path) && row.path.length > 0, "result path is missing");
  assertRealPath(sourceParentById, row.path);
  assert.ok(
    [...row.countryCounts.keys()].every((code) => input.selectedCountries.includes(code)),
    "row contains evidence outside the selected countries",
  );

  if (input.sliceMode === "formed") {
    assert.equal(row.crossingChild, undefined);
    assert.equal(row.sliceRelation, "formed-in-slice");
    assert.ok(Array.isArray(row.formedMembers) && row.formedMembers.length >= 1,
      "Formed rows must expose their canonical group members");
    assert.ok(Array.isArray(row.formedEvents) && row.formedEvents.length >= 1,
      "Formed rows must expose the dated events inside their branch");
    assert.equal(row.node.id, row.formedMembers[0].node.id,
      "Formed primary identity must be the highest group member");
    assert.equal(row.path.at(-1).id, row.node.id);
    assert.equal(row.node.formedKnown === false, false, "unknown formed became a Formed result");
    assert.ok(Math.abs(row.node.formed - input.target) <= input.maxDeltaYbp);
    assert.equal(row.delta, Math.abs(row.node.formed - input.target));
    assert.equal(row.total, row.formedEvents[0].total,
      "only the upper dated event may carry primary branch evidence");
    assert.deepEqual([...row.countryCounts], [...row.formedEvents[0].countryCounts]);
    const allDeltas = [];
    const allFormed = [];
    const eventById = new Map(row.formedEvents.map((event) => [event.node.id, event]));
    for (const event of row.formedEvents) {
      assert.equal(event.delta, Math.abs(event.node.formed - input.target));
      assert.ok(event.total > 0);
      assert.ok(required.some(code => (event.countryCounts.get(code) ?? 0) > 0));
      if (input.presenceMode === "all") {
        assert.ok(required.every(code => (event.countryCounts.get(code) ?? 0) > 0));
      }
      allDeltas.push(event.delta);
      allFormed.push(event.node.formed);
      for (const member of event.formedMembers) {
        assert.equal(member.node.formed, event.node.formed, "Formed event mixed source dates");
        assert.equal(member.node.formedKnown === false, false, "unknown formed became a group member");
        assert.equal(member.path.at(-1).id, member.node.id, "member path ends at another node");
        assertRealPath(sourceParentById, member.path);
      }
      assertConnectedSameFormedMembers(sourceParentById, event.formedMembers);
      if (event.parentEventId === null) continue;
      const parentEvent = eventById.get(event.parentEventId);
      assert.ok(parentEvent, `missing parent dated event ${event.parentEventId}`);
      assert.ok(parentEvent.formedMembers.some((member) => member.node.id === event.viaParentId),
        `event ${event.node.id} is not connected through a member of its parent event`);
      assert.equal(sourceParentById.get(event.node.id), event.viaParentId,
        `event ${event.node.id} uses a guessed rather than immediate source edge`);
    }
    assert.deepEqual(row.formedSpan, {
      olderYbp: Math.max(...allFormed),
      youngerYbp: Math.min(...allFormed),
    });
    assert.deepEqual(row.deltaRange, {
      minYbp: Math.min(...allDeltas),
      maxYbp: Math.max(...allDeltas),
    });
  } else {
    assert.ok(row.crossingChild, "Crossing row has no child endpoint");
    assert.equal(row.sliceRelation, "crossing-through");
    assert.equal(row.path.at(-2).id, row.node.id);
    assert.equal(row.path.at(-1).id, row.crossingChild.id);
    assert.ok(edgeCrossesTarget(row.node, row.crossingChild, input.target));
  }
}

function assertConnectedSameFormedMembers(sourceParentById, members) {
  const memberIds = new Set(members.map((member) => member.node.id));
  for (let index = 1; index < members.length; index += 1) {
    const member = members[index];
    assert.ok(memberIds.has(sourceParentById.get(member.node.id)),
      `Formed member ${member.node.id} is not connected to the group by a real parent edge`);
  }
}

function assertRealPath(sourceParentById, nodes) {
  for (let position = 0; position < nodes.length; position += 1) {
    const sourceParent = sourceParentById.get(nodes[position].id);
    assert.notEqual(sourceParent, undefined, `path node ${nodes[position].id} is absent from the source index`);
    if (position === 0) continue;
    assert.equal(sourceParent, nodes[position - 1].id, `non-parent-child path edge at ${nodes[position].id}`);
  }
}

function compactParentMap(compact) {
  return new Map(compact.nodeIds.map((id, index) => {
    const parentIndex = compact.nodes[index][1];
    return [id, parentIndex >= 0 ? compact.nodeIds[parentIndex] : null];
  }));
}

function resultIdentity(row) {
  return row.crossingChild
    ? `${row.node.id}>${row.crossingChild.id}`
    : row.formedEvents
      .flatMap((event) => event.formedMembers.map((member) => member.node.id))
      .join("|");
}

function resultPrimaryIdentity(row) {
  return row.crossingChild
    ? `${row.node.id}>${row.crossingChild.id}`
    : row.node.id;
}

function compareRows(a, b) {
  return b.total - a.total || a.delta - b.delta || resultIdentity(a).localeCompare(resultIdentity(b));
}

function medianSupport(rows) {
  if (rows.length === 0) return 2;
  const totals = rows.map((row) => row.total).sort((a, b) => a - b);
  return totals[Math.floor(totals.length / 2)];
}

function edgeCrossesTarget(parent, child, target) {
  return Math.min(parent.formed, child.formed) <= target && target <= Math.max(parent.formed, child.formed);
}

async function transpileDirectory(fromDir, toDir) {
  const entries = await fsPromises.readdir(path.join(ROOT, fromDir), { withFileTypes: true });
  await Promise.all(entries.map(async (entry) => {
    const from = path.join(fromDir, entry.name);
    const to = path.join(toDir, entry.name);
    if (entry.isDirectory()) return transpileDirectory(from, to);
    if (entry.isFile() && entry.name.endsWith(".ts")) {
      return transpileFile(from, to.replace(/\.ts$/, ".js"));
    }
  }));
}

async function transpileFile(from, to) {
  const sourcePath = path.join(ROOT, from);
  const targetPath = path.join(TEMP_ROOT, to);
  const source = await fsPromises.readFile(sourcePath, "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      isolatedModules: true,
    },
    fileName: sourcePath,
    reportDiagnostics: true,
  });
  if (result.diagnostics?.length) {
    throw new Error(ts.formatDiagnosticsWithColorAndContext(result.diagnostics, {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => ROOT,
      getNewLine: () => "\n",
    }));
  }
  await fsPromises.mkdir(path.dirname(targetPath), { recursive: true });
  await fsPromises.writeFile(targetPath, rewriteLocalSpecifiers(result.outputText, sourcePath));
}

function rewriteLocalSpecifiers(output, sourcePath) {
  return output.replace(
    /(from\s*["']|import\s*\(\s*["'])(\.{1,2}\/[^"']+)(["'])/g,
    (_match, prefix, specifier, suffix) => `${prefix}${resolveLocalSpecifier(specifier, sourcePath)}${suffix}`,
  );
}

function resolveLocalSpecifier(specifier, sourcePath) {
  if (path.extname(specifier)) return specifier.replace(/\.ts$/, ".js");
  const resolved = path.resolve(path.dirname(sourcePath), specifier.replaceAll("/", path.sep));
  if (fs.existsSync(`${resolved}.ts`)) return `${specifier}.js`;
  if (fs.existsSync(path.join(resolved, "index.ts"))) return `${specifier}/index.js`;
  return specifier;
}
