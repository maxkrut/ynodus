import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT, readCssEntry } from "./runtime.mjs";
import {
  analyzePayload, analysisState, analysisResult, analysisSliceResult,
  fakeWorker, fakeElement, fakeEventTarget, signatureRow, resultRow,
  captureCommittedQuery, provenanceIndex,
} from "./fixtures.mjs";

export function assertNeutralButtonColorContracts() {
  const buttonCss = readCssEntry(path.join(ROOT, "src/styles/app.css"));

  assert.doesNotMatch(
    buttonCss,
    /background\s*:\s*var\(--app-yellow\)|#fff2c2|#fff1cf|#fffdf6|#fff2d2/i,
    "buttons must not restore the yellow/orange fill",
  );
  assert.match(
    buttonCss,
    /button\s*\{[^}]*background\s*:\s*#fff/is,
    "shared utility buttons must use the neutral surface",
  );
}

export function assertSourceDateFormatting(formatDate, formatMachineDate) {
  assert.equal(formatDate("Jun 14 2026", "en"), "Jun 14, 2026");
  assert.equal(formatDate("Jun 14 2026", "ru"), "14 июн. 2026");
  assert.equal(formatMachineDate("Jun 14 2026"), "2026-06-14");
  assert.equal(formatMachineDate("2026-08-13T12:30:00.000Z"), "2026-08-13T12:30:00.000Z");
  assert.equal(formatMachineDate("Feb 30 2026"), null);
}

export function assertIndependentProvenanceMarkers(renderProvenanceStrip, en, renderProvenanceNotes) {
  const index = provenanceIndex();
  const context = {
    t: (key) => en[key] ?? key,
    locale: "en",
  };
  const strip = renderProvenanceStrip(index, context);
  const markup = strip + renderProvenanceNotes(index, context);

  assert.ok(strip.includes(en.hrasSnapshot));
  assert.match(strip, /class="provenance-version">14\.03\.00/);
  assert.ok(strip.includes(en.yfullTreeMarker));
  assert.match(strip, /14\.04\.0/);
  assert.ok(strip.includes(en.metadataUnavailable), "a missing release date must not be replaced by the index build date");
  assert.ok(markup.includes(en.sourceVersionsDiffer),
    "the independent-source relationship must stay visible in the header");
  const dated = renderProvenanceStrip({ ...index, referenceRelease: { date: "2026-09-22", sourceUrl: "https://example.invalid/release" } }, context);
  assert.match(dated, /data-provenance-entity="yfull"[\s\S]*?datetime="2026-09-22"/);
  assert.match(strip, /data-status="different"/);
  const matching = renderProvenanceStrip({ ...index, version: "v14.03.00", officialVersion: "14.3.0" }, context);
  assert.match(matching, /data-status="matching"/);
  assert.ok(matching.includes(en.sourceVersionsMatch));
  for (const marker of ["-", "synthetic", ""]) {
    assert.match(renderProvenanceStrip({ ...index, version: marker, officialVersion: marker }, context), /data-status="unknown"/);
  }
  assert.match(strip, /data-annotation="snapshot-notes"/,
    "the retained-data limit must remain accessible from the header");
  assert.match(strip, /2026/);
  assert.match(strip, /datetime="2026-06-14"/, "source dates must expose valid, timezone-stable machine dates");
  assert.match(strip, /href="\.\/legal\/LICENSE\.txt"/);
  assert.match(strip, /href="https:\/\/github\.com\/YFullTeam\/YTree\/blob\/master\/LICENSE\.md"/);
  assert.match(strip, /href="https:\/\/github\.com\/hprovyn\/hras\/blob\/main\/LICENSE"/);
  assert.match(strip, /data-provenance-entity="hras"[\s\S]*?href="https:\/\/github\.com\/hprovyn\/hras\/blob\/main\/LICENSE"/,
    "the HRAS Apache notice must stay in the HRAS row");
  assert.match(strip, /data-provenance-entity="app"[\s\S]*?href="\.\/legal\/LICENSE\.txt"/,
    "the yNodus license must stay in the yNodus row");
  assert.equal([...strip.matchAll(/data-provenance-entity="(?:hras|yfull|app)"/g)].length, 3,
    "HRAS, YFull and yNodus must stay three separately recorded entities");
  assert.equal([...strip.matchAll(/class="provenance-entity"/g)].length, 3,
    "each visible provenance fact must name its source entity");
  assert.equal([...strip.matchAll(/class="provenance-version"/g)].length, 3,
    "every provenance fact must expose its own recorded version");
  assert.equal([...strip.matchAll(/class="provenance-date"/g)].length, 3,
    "HRAS, YFull, and yNodus must each expose their own recorded date");
  for (const fact of strip.split('<div class="provenance-row provenance-fact"').slice(1)) {
    const entity = fact.indexOf('class="provenance-entity"');
    const version = fact.indexOf('class="provenance-version"');
    const date = fact.indexOf('class="provenance-date"');
    assert.ok(
      entity >= 0 && entity < version && version < date,
      "provenance facts must retain the shared entity → version → date reading order",
    );
  }
  assert.equal([...strip.matchAll(/class="provenance-links"/g)].length, 3,
    "every source row must expose its own direct links and licenses");
  assert.doesNotMatch(markup, /source-(?:ok|warn)|sync-status/i);
  assert.match(strip, /href="https:\/\/github\.com\/maxkrut\/ynodus"/,
    "the app repository must use the address approved by the owner");
  for (const repository of ["hprovyn/hras", "YFullTeam/YTree", "maxkrut/ynodus"]) {
    assert.ok(strip.includes(`GitHub: ${repository}`));
    assert.ok(strip.includes(`<span>${repository}</span>`));
  }
  assert.equal([...strip.matchAll(/class="github-icon"/g)].length, 3);
}

export function assertPublishedLegalAssets() {
  const publicLicense = fs.readFileSync(path.join(ROOT, "public/legal/LICENSE.txt"), "utf8");
  const publicNotice = fs.readFileSync(path.join(ROOT, "public/legal/NOTICE.txt"), "utf8");
  assert.equal(publicLicense, fs.readFileSync(path.join(ROOT, "LICENSE"), "utf8"),
    "the published app-license target must be the repository Apache-2.0 license");
  assert.equal(publicNotice, fs.readFileSync(path.join(ROOT, "NOTICE.md"), "utf8"),
    "the published source ledger must match the repository notice");
}

export function assertSharedDialogAndResponsiveContracts() {
  const elementsSource = fs.readFileSync(path.join(ROOT, "src/app/elements.ts"), "utf8");
  assert.match(elementsSource, /app\.append\(selectionPanel\)/,
    "the shared country dialog must live at the always-visible application root");

  const researchSource = fs.readFileSync(path.join(ROOT, "src/app/research-controller.ts"), "utf8");
  const researchMarkupSource = ["research-markup.ts", "profile-markup.ts", "country-overview-markup.ts"]
    .map(file => fs.readFileSync(path.join(ROOT, "src/app", file), "utf8")).join("\n");
  const treeTableSource = fs.readFileSync(path.join(ROOT, "src/app/evidence-tree-table.ts"), "utf8");
  assert.match(treeTableSource, /visible\.slice\(offset, offset \+ size\)/,
    "both tree presentations must bound the rendered page");
  assert.match(treeTableSource, /for \(let parent = entry\.parent; parent; parent = parent\.parent\)/,
    "paging must retain the real ancestor context");
  assert.doesNotMatch(researchMarkupSource, /class="methodology-card"/,
    "research explanations belong next to their subjects, not in a combined methodology wall");
  assert.doesNotMatch(researchSource, /research-empty-panel[\s\S]{0,500}data-open-subclade-dialog/,
    "the empty profile must use the workspace-level picker action instead of duplicating it inside the empty state");
  assert.match(
    researchSource,
    /async function restoreHistoryRoute[\s\S]*invalidateResearchRequest\(\);[\s\S]*state\.researchView = route\.view;[\s\S]*render\(\)/,
    "browser history navigation must invalidate stale research requests and restore the routed entity focus",
  );
  const navigationSource = fs.readFileSync(path.join(ROOT, "src/app/research-navigation.ts"), "utf8");
  assert.match(navigationSource, /token === generation\) restoreNavigationPosition/,
    "only current navigation may restore focus and scroll");

  const css = readCssEntry(path.join(ROOT, "src/styles/app.css"));
  assert.doesNotMatch(
    css,
    /\.mockup-(?:toolbar-switches|switch-field|switch-label|page-stats|locale-switcher)\b/,
    "removed production controls must not leave unreachable legacy selector families behind",
  );
  assert.match(css, /\.time-axis\s*\{[^}]*position\s*:\s*relative[^}]*padding-top\s*:\s*42px/is,
    "the production timeline must share one explicit, unclipped geometry across its nested layers");
  assert.match(css, /\.query-results-jump\s*\{[^}]*order\s*:\s*-1/is,
    "mobile must present a compact answer summary before controls and timeline context");
  assert.match(css, /\.annotation-trigger\s*\{[^}]*background\s*:\s*transparent/is,
    "contextual help badges must remain compact beside their subject labels");
  assert.match(css, /\.context-annotation\s*\{[^}]*position\s*:\s*fixed/is,
    "annotations must float without expanding the result or query layout");
  assert.match(css, /\.provenance-links a\s*\{[^}]*min-width\s*:\s*24px[^}]*min-height\s*:\s*24px/is,
    "compact provenance links must retain usable pointer targets");

  const sliceAnalysisSource = fs.readFileSync(path.join(ROOT, "src/worker/slice-analysis/density-cache.ts"), "utf8");
  assert.match(sliceAnalysisSource, /MAX_ROWS\s*=\s*100_000/,
    "density cache must be bounded by retained rows as well as entry count");
  assert.match(sliceAnalysisSource, /count\s*>\s*MAX_ROWS/);
}
