import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT, readCssEntry } from "./runtime.mjs";
import {
  analyzePayload, analysisState, analysisResult, analysisSliceResult,
  fakeWorker, fakeElement, fakeEventTarget, signatureRow, resultRow,
  captureCommittedQuery, provenanceIndex,
} from "./fixtures.mjs";

export function assertHeaderAndLanguageContracts(renderAppShell, en) {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /<html\s+lang="en">/, "the document language must default to English");
  const constantsSource = fs.readFileSync(path.join(ROOT, "src/app/constants.ts"), "utf8");
  assert.match(constantsSource, /DEFAULT_LOCALE:\s*Locale\s*=\s*"en"/);
  assert.match(constantsSource, /DATA_URL\s*=\s*"\.\/data\/hras-index\.json"/,
    "the runtime dataset must remain relative to the configured application base");
  const bootstrapSource = fs.readFileSync(path.join(ROOT, "src/app/bootstrap.ts"), "utf8");
  assert.match(bootstrapSource, /dataUrl:\s*new URL\(DATA_URL,\s*document\.baseURI\)\.href/,
    "the page must resolve the runtime dataset URL before sending it to the Web Worker");
  const workerSource = fs.readFileSync(path.join(ROOT, "src/analysis-worker.ts"), "utf8");
  assert.match(workerSource, /returned \$\{received\} instead of JSON/,
    "a static-host HTML fallback must produce a useful dataset-loading error");
  assert.match(workerSource, /message\.id !== latestLoadId/,
    "a superseded or timed-out dataset load must not mutate the active worker index");
  const stateSource = fs.readFileSync(path.join(ROOT, "src/app/state.ts"), "utf8");
  assert.match(stateSource, /locale:\s*DEFAULT_LOCALE/);

  const markup = renderAppShell((key) => en[key] ?? key);
  assert.match(
    markup,
    /<span class="brand-logo-text" role="img" aria-label="yNodus">\s*<span class="brand-logo-initial" aria-hidden="true">y<\/span><span aria-hidden="true">Nodus<\/span>/,
    "the text logo must expose one yNodus accessible name while keeping the initial separately styleable",
  );

  const languageStart = markup.indexOf('<label class="header-language"');
  const languageEnd = markup.indexOf("</label>", languageStart) + "</label>".length;
  const mainStart = markup.indexOf('<main id="time-workspace" class="layout"');
  const countryDialogStart = markup.indexOf('<dialog id="selection-panel"');
  assert.ok(languageStart >= 0 && languageEnd > languageStart, "language selector must render in the header");
  assert.ok(languageEnd < mainStart, "language selector must remain outside the main country controls");
  assert.ok(mainStart < countryDialogStart, "country picker must remain a separate dialog inside the main UI");

  const languageMarkup = markup.slice(languageStart, languageEnd);
  assert.match(languageMarkup, /<select id="locale-switcher"[^>]*>/);
  assert.match(languageMarkup, /<option value="en" lang="en">English<\/option>/);
  assert.match(languageMarkup, /<option value="ru" lang="ru" selected>Русский<\/option>/);
  assert.equal([...languageMarkup.matchAll(/<option\b/g)].length, 2, "only English and Russian are supported");
  assert.doesNotMatch(languageMarkup, /[\u{1F1E6}-\u{1F1FF}]/u, "language choices must not use national flags");
  assert.doesNotMatch(languageMarkup, /class="[^"]*flag/i, "language selector must not reuse country-flag styling");
  assert.match(markup, /id="target-era"[^>]*role="switch"[^>]*value="BCE"[\s\S]*data-i18n="eraBceShort"[\s\S]*data-i18n="eraCeShort"/,
    "the binary target-era control must be a localized switch");
  assert.match(markup, /id="target-ybp"[^>]*>target: 5449 ybp</,
    "the first rendered target summary must use civil 3500 BCE without a year zero");
  assert.match(markup, /id="target-slider"[^>]*value="6551"/,
    "the first rendered timeline handle must agree with the configured target before hydration");

  const provenanceStart = markup.indexOf('<div id="provenance-strip"');
  const headerEnd = mainStart;
  assert.ok(provenanceStart >= 0 && provenanceStart < headerEnd, "provenance must remain inside the compact header");
  assert.ok(provenanceStart < mainStart, "provenance links must be available before the main result surface");
  assert.ok(provenanceStart < countryDialogStart, "provenance must not be hidden behind a dialog");
  assert.equal([...markup.matchAll(/data-provenance-entity="(?:hras|yfull|app)"/g)].length, 3,
    "the source rail must expose exactly one visible fact for HRAS, YFull, and yNodus");
  const provenanceMarkup = markup.slice(provenanceStart, mainStart);
  const primaryFacts = provenanceMarkup;
  assert.equal([...primaryFacts.matchAll(/class="provenance-version"/g)].length, 3,
    "all independent source markers must stay visible before the optional references");
  assert.equal([...primaryFacts.matchAll(/class="provenance-date"/g)].length, 3,
    "all recorded dates must stay visible before the optional references");
  for (const requiredTarget of [
    "hras.yseq.net/", "hras.yseq.net/data/manifest", "github.com/hprovyn/hras",
    "yfull.com/tree/", "raw.githubusercontent.com/YFullTeam/YTree", "github.com/YFullTeam/YTree",
    "./data/hras-index.json", "./legal/NOTICE.txt", "./legal/LICENSE.txt", "github.com/maxkrut/ynodus",
  ]) {
    assert.ok(provenanceMarkup.includes(requiredTarget), `header provenance must link to ${requiredTarget}`);
  }
  assert.match(primaryFacts, /class="provenance-version"[\s\S]*data-annotation="source-sync"/,
    "source independence must stay visible before references");
  assert.equal([...primaryFacts.matchAll(/<nav class="provenance-links"/g)].length, 3,
    "source and license links must stay visible in each source row");
  assert.match(provenanceMarkup, /data-provenance-entity="app"[\s\S]*?class="provenance-version"[\s\S]*?data-annotation="snapshot-notes"/,
    "privacy notes must be attached to the application version");
  assert.doesNotMatch(provenanceMarkup, /class="provenance-(privacy|ancient)"/);
  assert.match(provenanceMarkup, /id="provenance-notes" hidden/,
    "extended snapshot notes are disclosed through the application annotation");
  assert.doesNotMatch(provenanceMarkup, /provenance-details|<details/,
    "source caveats must not require opening a disclosure");

  const queryStart = markup.indexOf('<section class="query-zone query-bar"');
  const timelineStart = markup.indexOf('<section class="timeline-zone app-zone"');
  const resultsStart = markup.indexOf('<section class="results-zone app-zone"');
  assert.ok(headerEnd < queryStart && queryStart < timelineStart && timelineStart < resultsStart,
    "the surface must read as header, scope/settings, timeline, then results");
  assert.equal([...markup.matchAll(/id="export-csv"/g)].length, 1, "CSV download must have one canonical control");
  assert.doesNotMatch(markup.slice(0, mainStart), /id="export-csv"/, "CSV must not compete with header actions");
  assert.match(markup, /id="include-crossing"[^>]*type="checkbox"[^>]*aria-describedby="include-crossing-description"/,
    "Crossing must be an optional secondary result set while Formed remains primary");
  assert.doesNotMatch(markup, /name="slice-mode"|data-slice-mode=/,
    "Formed and Crossing must not be mutually exclusive page modes");
  assert.match(markup, /id="crossing-results-section"[^>]*hidden[\s\S]*data-result-mode="crossing"/,
    "the optional Crossing result set must have its own clearly separated table");
  assert.doesNotMatch(markup, /full-range-toggle|time-axis-full-range/, "the 10000+ checkbox must be removed from the product surface");
  assert.doesNotMatch(markup, /class="zone-number"/, "section headings must not expose mockup sequence numbers");
  assert.doesNotMatch(markup, /id="open-project-info"|id="mockup-project-info-dialog"/,
    "source and license information must live in the header instead of an About dialog");
  assert.match(markup.slice(0, mainStart), /data-i18n="workbenchTagline"/,
    "the brand header must explain what the product does");
  const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, "package-lock.json"), "utf8"));
  assert.equal(lock.version, version, "the lockfile root must match the application version");
  assert.equal(lock.packages[""].version, version, "the locked package must match the application version");
  assert.equal(constantsSource.match(/APP_VERSION\s*=\s*"v([^"]+)"/)?.[1], version,
    "the runtime and CSV version must match the package version");
  assert.equal(markup.slice(0, mainStart).match(/class="version-pill"[^>]*>([^<]+)<\/span>/)?.[1],
    version, "the header must show the complete current release, including patch");
  assert.doesNotMatch(markup, /class="mockup-page-stats"|id="stat-samples"|id="stat-result-support"/,
    "the redundant cohort/result/support counter strip must not compete with the canonical table");
  assert.match(markup, /id="live-status" class="visually-hidden"/,
    "analysis status must remain available to assistive technology without a visible Live badge");
  assert.match(markup, /data-annotation="formed"[\s\S]*data-annotation="crossing"/,
    "each result set must expose its own explanation");
  assert.match(markup, /data-annotation="countries"[\s\S]*id="selection-panel-toggle"/,
    "country evidence must be the sole topology-independent scope of the time query");
  assert.doesNotMatch(markup, /id="tab-subclades"|id="subclade-selection-panel"|data-use-profile-scope/,
    "time search must not expose an additional branch-scope selector");
  assert.match(markup, /class="nested-page-breadcrumb"[\s\S]*data-research-back/,
    "the profile must read as a nested screen with an explicit return to time results");
  assert.match(markup, /class="research-entrypoints"[\s\S]*data-research-view="time"[\s\S]*data-research-view="profile"/,
    "both user entry scenarios must remain directly accessible");
  assert.match(markup, /data-annotation="countries"[\s\S]*data-i18n="countryEvidenceMethod"/,
    "country evidence limits remain in the contextual annotation and inside the picker");
  assert.doesNotMatch(markup, /data-i18n="countryMetadataShort"/,
    "the time panel must not repeat the country annotation as a permanent footnote");
  const profileStart = markup.indexOf('<main id="profile-workspace"');
  const countryEvidenceStart = markup.indexOf('<main id="country-evidence-workspace"');
  const helpStart = markup.indexOf('<aside id="context-annotation"');
  const profileMarkup = markup.slice(profileStart, countryEvidenceStart);
  const countryEvidenceMarkup = markup.slice(countryEvidenceStart, helpStart);
  for (const nonTemporalMarkup of [profileMarkup, countryEvidenceMarkup]) {
    assert.doesNotMatch(nonTemporalMarkup, /target-year|target-slider|max-delta-ybp|data-slice-mode|data-presence-mode/,
      "profile and country-evidence workspaces must not expose time-query controls");
  }
  assert.match(profileMarkup, /id="profile-lookup"[\s\S]*id="profile-clade-search"/,
    "known subclades must be entered inline without time controls or a modal");
  assert.match(countryEvidenceMarkup, /data-back-to-profile/);
  assert.match(markup.slice(timelineStart, resultsStart), /class="time-axis-scale-note"[\s\S]*data-annotation="log-scale"/,
    "the ancient part of the timeline must explain its logarithmic scale between its endpoints");
  assert.match(
    markup.slice(timelineStart, resultsStart),
    /id="timeline-zone-title"[^>]*data-i18n="densityMap"[\s\S]*data-i18n="densityContextLegend"[\s\S]*data-i18n="densityResultLegend"/,
    "the context map must name its cohort scope, height encoding, and separate current-result overlay",
  );

  assert.doesNotMatch(markup, /mockup-help-dialog|data-open-help/,
    "the general help modal is replaced by contextual annotations");
  for (const subject of ["countries", "date", "window", "minimum", "presence", "formed", "crossing", "density"]) {
    assert.ok(markup.includes(`data-annotation="${subject}"`), `${subject} must expose a contextual explanation`);
  }

  const timePanelStart = queryStart;
  const timePanelEnd = markup.indexOf("</section>", timePanelStart);
  const timePanelMarkup = markup.slice(timePanelStart, timePanelEnd);
  assert.ok(timePanelStart >= 0 && timePanelEnd > timePanelStart,
    "the whole committed query must be one readable control row");
  assert.match(timePanelMarkup, /class="query-parameters"[\s\S]*data-i18n-aria-label="timeMatchQuery"/);
  for (const controlId of ["query-target-control", "query-delta-control", "query-min-control"]) {
    assert.match(timePanelMarkup, new RegExp(`id="${controlId}"[\\s\\S]*?<(?:input|button)`),
      `${controlId} must expose its editable value directly in the query row`);
  }
  assert.doesNotMatch(timePanelMarkup, /query-(?:date|delta|presence|min)-popover|popovertarget=/,
    "scalar query values must not be hidden in popovers");
  for (const id of ["target-year", "target-era", "max-delta-ybp", "min-result-samples", "include-crossing", "presence-mode-toggle"]) {
    assert.match(timePanelMarkup, new RegExp(`id="${id}"`), `${id} must stay inside the one-row query`);
  }
  for (const id of ["selection-panel-toggle"]) {
    assert.match(timePanelMarkup, new RegExp(`id="${id}"`), `${id} must read as part of the same query sentence`);
  }
  assert.match(markup, /id="result-macrogroup-filter"[\s\S]*data-i18n="allMacroGroups"/,
    "macrogroup narrowing must live with the result table rather than the query controls");
  assert.match(timePanelMarkup, /id="max-delta-ybp"[^>]*max="999999"/,
    "Hit +/- input must have a finite six-digit upper bound");
  assert.match(timePanelMarkup, /id="target-era"[^>]*role="switch"/,
    "the two-value BCE/CE control must use switch semantics");
  assert.match(timePanelMarkup, /id="presence-mode-toggle"[^>]*role="switch"[\s\S]*id="presence-switch-label"/,
    "the two-value presence control must use one labelled switch");
  assert.match(timePanelMarkup, /id="include-crossing"[^>]*type="checkbox"[^>]*role="switch"[^>]*aria-labelledby=/,
    "the optional Crossing table uses a labelled native switch in the two-row panel");
  assert.match(timePanelMarkup, /id="density-sync"[^>]*type="checkbox"[^>]*role="switch"/,
    "linking chart step to the window uses the same native switch");
  assert.doesNotMatch(timePanelMarkup, /id="mode-any"|id="mode-all"|<select id="target-era"/,
    "binary choices must not fall back to paired buttons or a select");
  assert.match(timePanelMarkup, /data-delta-step="-50"[\s\S]*id="max-delta-ybp"[\s\S]*data-delta-step="50"/,
    "the Hit +/- stepper must read as minus, value, plus");
  const scopeSwitcherStart = timePanelMarkup.indexOf('id="selection-panel-toggle"');
  const presenceStart = timePanelMarkup.indexOf('id="query-presence-control"');
  const crossingOptionStart = timePanelMarkup.indexOf('id="query-crossing-control"');
  assert.ok(scopeSwitcherStart >= 0 && presenceStart > scopeSwitcherStart,
    "Presence must follow the country scope it filters");
  assert.ok(crossingOptionStart > presenceStart,
    "the optional Crossing add-on must close the query sentence rather than interrupt the evidence filters");
  assert.match(timePanelMarkup, /id="include-crossing"[^>]*aria-describedby="include-crossing-description"/,
    "the compact Crossing chip must keep the full option wording for assistive technology");
  assert.match(timePanelMarkup, /id="query-crossing-control"[\s\S]*id="include-crossing"[\s\S]*aria-describedby="include-crossing-description"/,
    "the visible Crossing switch must expose the full option description");

}

export function assertWordmarkCssContracts() {
  const css = readCssEntry(path.join(ROOT, "src/styles/app.css"));
  const componentRoot = path.join(ROOT, "src/styles/workbench");
  const headerSelector = /\.(?:app-header|title-block|brand-head|brand-logo-(?:text|initial)|version-pill|header-(?:utilities|language|provenance)|provenance-[\w-]+|github-icon|research-entrypoints|workspace-link-note)\b|\[data-provenance-entity/;
  for (const file of fs.readdirSync(componentRoot).filter(file => file.endsWith(".css") && file !== "header.css")) {
    assert.doesNotMatch(fs.readFileSync(path.join(componentRoot, file), "utf8"), headerSelector,
      `header and navigation rules belong to header.css, not ${file}`);
  }
  const imports = fs.readFileSync(path.join(ROOT, "src/styles/app.css"), "utf8");
  assert.equal((imports.match(/@import "\.\/workbench\/header\.css";/g) ?? []).length, 1,
    "the complete header component is imported once");
  const mainSource = fs.readFileSync(path.join(ROOT, "src/main.ts"), "utf8");
  const flagSource = fs.readFileSync(path.join(ROOT, "src/styles/flags.scss"), "utf8");
  assert.doesNotMatch(css, /--app-font\s*:[^;]*Geologica Wordmark/is);
  assert.match(css, /@font-face[\s\S]*?Geologica/i);
  assert.doesNotMatch(css, /fonts\.googleapis\.com/);
  assert.match(css, /\.brand-logo-text\s*\{[^}]*font-family\s*:[^;}]*Geologica/is);
  assert.match(css, /\.brand-logo-initial\s*\{[^}]*color\s*:/is);
  assert.match(css, /\.brand-head\s*\{[^}]*display\s*:\s*flex/is);
  assert.doesNotMatch(css, /\.title-block\s*\{[^}]*grid-template-columns\s*:\s*48px/is,
    "a retired icon column must not offset the tagline");
  assert.match(css, /\.query-parameters\s*\{[^}]*align-items\s*:\s*end/is,
    "query fields must share one baseline");
  assert.match(css, /\.query-inline-value\s*\{[^}]*grid-template-columns\s*:\s*70px/is,
    "mobile year input must reserve a usable width beside the era switch");
  assert.match(css, /\.table-wrap thead tr\s*\{[^}]*display\s*:\s*flex/is,
    "mobile sorting must remain visible and wrap instead of being clipped");
  assert.match(css, /\.density-cell\s*\{[^}]*height\s*:\s*44px/is,
    "density interactions need a stable touch target independent of visual bar height");
  assert.match(css, /\.density-macro-stack\s*\{[^}]*flex-direction\s*:\s*column-reverse/is);
  assert.match(css, /\.density-result-range\s*\{[^}]*box-shadow\s*:\s*inset[^}]*pointer-events\s*:\s*none/is,
    "matching intervals share a contour without blocking the coloured columns");
  assert.match(css, /\.profile-formed-groups\s*\{[^}]*display\s*:\s*grid/is,
    "profile must show the time-search groups in a bounded list");
  assert.match(css, /\.evidence-tree-node\.same-formed\s*\{[^}]*background/is,
    "matching source-age links must be visible in the full profile tree");
  assert.match(css, /\.row-macro-label\s*\{[^}]*color\s*:\s*var\(--row-color\)/is);
  assert.match(css, /\.subclade-link\s*\{[^}]*color\s*:\s*var\(--row-color/is);
  assert.match(css, /#app\s*\{[^}]*width\s*:\s*100%[^}]*max-width\s*:\s*none/is);
  assert.match(css, /\.app-header\s*\{[^}]*display\s*:\s*grid/is);
  assert.match(css, /\.provenance-row\s*\{[^}]*grid-template-columns/is);
  assert.match(css, /\.table-sort-button\s*\{[^}]*border\s*:\s*0[^}]*background\s*:\s*transparent/is);
  const tableFontSize = css.match(/\.table-wrap table\s*\{[^}]*font-size\s*:\s*([\d.]+)px/is);
  assert.ok(tableFontSize && Number(tableFontSize[1]) >= 13,
    "Result text must remain at least 13px; larger readable typography is allowed");
  assert.doesNotMatch(mainSource, /flag-icons\/css\/flag-icons/);
  assert.match(mainSource, /\.\/styles\/flags\.scss/);
  assert.match(mainSource, /\.\/styles\/app\.css/);
  assert.doesNotMatch(mainSource, /styles\/(?:mockup|production|quiet-table)\.css/);
  assert.match(flagSource, /\$flag-icons-use-square:\s*false/);
  assert.match(flagSource, /"gb-eng"[\s\S]*"gb-sct"[\s\S]*"gb-wls"/);
}

export function assertDensityFormedLayerGrouping(groupDensityFormedLayers) {
  const row = (id, parentId, formed, project = "R") => ({
    node: { id, project, formed },
    parentId,
    total: 1,
  });
  const rows = [
    row("R-A", null, 4000),
    row("R-B", "R-A", 4000),
    row("R-C", "R-B", 4000),
    row("R-D", "R-A", 3500),
    row("R-E", null, 4000),
  ];
  const layers = groupDensityFormedLayers(rows, new Set(["R-B", "R-D"]));
  assert.equal(layers.length, 3, "unrelated branches or different dates must remain separate formed layers");
  const connected = layers.find((layer) => layer.rootId === "R-A" && layer.formed === 4000);
  assert.deepEqual(connected.rows.map((entry) => entry.node.id), ["R-A", "R-B", "R-C"]);
  assert.equal(connected.currentResultCount, 1,
    "a connected same-date layer must retain the count of highlighted canonical results");
  assert.equal(layers.find((layer) => layer.rootId === "R-D").currentResultCount, 1);
}
