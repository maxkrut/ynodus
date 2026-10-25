import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./runtime.mjs";
import {
  analyzePayload, analysisState, analysisResult, analysisSliceResult,
  fakeWorker, fakeElement, fakeEventTarget, signatureRow, resultRow,
  captureCommittedQuery, provenanceIndex,
} from "./fixtures.mjs";

export function assertLazyCountryPills(
  renderCountryPills,
  materializeCountryPills,
  chipLimit,
  _mobileChipLimit,
) {
  const entries = Array.from({ length: 18 }, (_, index) => [`C${String(index).padStart(2, "0")}`, index + 1]);
  const markup = renderCountryPills(entries, {
    t: (key) => key,
    formatNumber: (value) => String(value),
    formatCalendar: (value) => String(value),
    countryFlag: (code) => `flag-${code}`,
    subcladeUrl: () => "",
    moreItemsLabel: (count) => `+${count}`,
    sliceMode: "formed",
    countryChipLimit: Math.min(chipLimit, 8),
  });
  assert.equal(
    [...markup.matchAll(/<span class="country-pill">/g)].length,
    Math.min(chipLimit, 8),
    "the responsive collapsed country view must render one visible pill set",
  );
  assert.match(markup, /class="country-pills-viewport [^"]*country-pills-responsive/);
  assert.equal([...markup.matchAll(/data-lazy-country-pills="[^"]+"/g)].length, 1);
  assert.match(markup, /data-lazy-country-pills="[^"]+"/);
  assert.match(markup, /<div class="chip-popover" data-country-pill-popover><\/div>/);
  assert.doesNotMatch(markup, /flag-C17<\/span>/, "collapsed rows must not embed hidden pill markup");

  const popover = { innerHTML: "" };
  const details = {
    dataset: { lazyCountryPills: JSON.stringify([["<img src=x>", "<b>42</b>"]]) },
    querySelector: () => popover,
  };
  materializeCountryPills(details, () => '<span class="safe-flag" aria-hidden="true"></span>');
  assert.match(popover.innerHTML, /safe-flag/);
  assert.match(popover.innerHTML, /country-code">&lt;img src=x&gt;/);
  assert.match(popover.innerHTML, /<strong>&lt;b&gt;42&lt;\/b&gt;<\/strong>/);
  assert.doesNotMatch(popover.innerHTML, /<img|<b>42/);
  assert.equal(details.dataset.lazyCountryPills, undefined);
  assert.equal(details.dataset.countryPillsMaterialized, "true");
  const inactive = renderCountryPills([["AAA", 8], ["BBB", 3]], {
    t: () => "Below minimum", formatNumber: String, countryFlag: () => "flag",
    moreItemsLabel: String, countryChipLimit: 1,
  }, [["BBB", 3]]);
  assert.match(inactive, /country-code">AAA<\/span>/);
  const payload = inactive.match(/data-lazy-country-pills="([^"]+)"/)[1].replaceAll("&quot;", '"');
  details.dataset.lazyCountryPills = payload;
  materializeCountryPills(details, () => "flag");
  assert.match(popover.innerHTML, /country-pill-inactive/);
  assert.match(popover.innerHTML, /data-annotation="country-minimum"/);
  assert.match(popover.innerHTML, /aria-label="BBB: Below minimum"/);
  assert.match(popover.innerHTML, /country-code">BBB<\/span>/);
  assert.match(popover.innerHTML, /<strong>3<\/strong>/);
}

export function assertSourceDateInversionContract(resultsCsvText, renderRows, en) {
  const inverted = resultRow("R-INVERTED-PARENT", 5, "crossing-through", "R-INVERTED-CHILD");
  inverted.node.formed = 3000;
  inverted.crossingChild.formed = 6000;
  inverted.path = [inverted.node, inverted.crossingChild];

  const csv = resultsCsvText({
    formedRows: [],
    crossingRows: [inverted],
    selectedCountries: ["AA"],
    presenceMode: "any",
    minResultSamples: 0,
    targetYbp: 4500,
    targetYear: "2500",
    targetEra: "BCE",
    macroGroupFilter: null,
    formatCalendar: (value) => `${value} ybp`,
    subcladeUrl: (id) => `https://example.test/${id}`,
  });
  const [headerLine, valueLine] = csv.split("\n");
  const header = headerLine.split(",");
  const values = valueLine.split(",");
  assert.equal(
    values[header.indexOf("source_date_anomaly")],
    "parent_formed_younger_than_child",
    "CSV must preserve and annotate an inverted source-date edge",
  );

  const markup = renderRows({
    rows: [inverted],
    tableRowLimit: 10,
    tableSort: { key: "total", direction: "desc" },
  }, {
    t: (key) => en[key],
    formatNumber: String,
    formatCalendar: (value) => `${value} ybp`,
    countryFlag: () => "",
    subcladeUrl: (id) => `https://example.test/${id}`,
    moreItemsLabel: (count) => `Show ${count} more`,
    sliceMode: "crossing",
  });
  assert.match(markup.replace(/<[^>]*>/g, ""), /3000 ybp → ~6000 ybp/);
  assert.match(markup, new RegExp(en.sourceDateInversion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

export function assertSameFormedTableGrouping(
  resultsCsvText,
  renderRows,
  renderTimeTableHead,
  en,
  ru,
) {
  const grouped = resultRow("R-A", 30, "formed-in-slice");
  grouped.node.formed = 6000;
  grouped.delta = 500;
  const sameDate = { id: "R-B", project: "R", formed: 6000, formedKnown: true };
  const lower = { id: "R-C", project: "R", formed: 5200, formedKnown: true };
  const deep = { id: "R-D", project: "R", formed: 4700, formedKnown: true };
  grouped.formedMembers = [
    { node: grouped.node, path: [grouped.node] },
    { node: sameDate, path: [grouped.node, sameDate] },
  ];
  grouped.formedEvents = [
    {
      node: grouped.node,
      path: [grouped.node],
      formedMembers: grouped.formedMembers,
      total: 30,
      delta: 500,
      countryCounts: new Map([["AA", 30]]),
      parentEventId: null,
      viaParentId: null,
    },
    {
      node: lower,
      path: [grouped.node, sameDate, lower],
      formedMembers: [{ node: lower, path: [grouped.node, sameDate, lower] }],
      total: 18,
      delta: 300,
      countryCounts: new Map([["AA", 18]]),
      parentEventId: "R-A",
      viaParentId: "R-B",
    },
    {
      node: deep,
      path: [grouped.node, sameDate, lower, deep],
      formedMembers: [{ node: deep, path: [grouped.node, sameDate, lower, deep] }],
      total: 11,
      delta: 800,
      countryCounts: new Map([["AA", 11]]),
      parentEventId: "R-C",
      viaParentId: "R-C",
    },
  ];
  grouped.formedSpan = { olderYbp: 6000, youngerYbp: 4700 };
  grouped.deltaRange = { minYbp: 300, maxYbp: 800 };

  const context = {
    t: (key) => en[key],
    formatNumber: String,
    formatCalendar: (value) => `${value} ybp`,
    countryFlag: () => "",
    subcladeUrl: (id) => `https://example.test/${id}`,
    moreItemsLabel: (count) => `Show ${count} more`,
    locale: "en",
    sliceMode: "formed",
  };
  const markup = renderRows({
    rows: [grouped],
    tableRowLimit: 10,
    tableSort: { key: "formed", direction: "desc" },
  }, context);

  assert.equal([...markup.matchAll(/data-result-role="formed"/g)].length, 1,
    "one connected dated branch must render as one canonical table row");
  assert.equal([...markup.matchAll(/<td class="mockup-support">/g)].length, 1,
    "nested event support must not create additional table support cells");
  assert.match(markup, /data-result-composition data-tooltip-pin/);
  assert.doesNotMatch(markup, /formed-branch-summary-text/);
  assert.doesNotMatch(markup, /data-open-formed-branch|<dialog class="formed-branch-dialog"/);
  assert.match(markup, /R-A and 3 descendant subclades: 4 subclades in total/);
  assert.match(markup, /Connected groups sharing a Formed estimate: 3/,
    "composition must count connected groups, which need not have distinct ages");
  assert.match(markup, /Separate groups may have the same date/);
  const sameAgeMarkup = renderRows({
    rows: [{
      ...grouped,
      formedEvents: [grouped.formedEvents[0]],
      formedSpan: { olderYbp: 6000, youngerYbp: 6000 },
      deltaRange: { minYbp: 500, maxYbp: 500 },
    }],
    tableRowLimit: 10,
    tableSort: { key: "formed", direction: "desc" },
  }, context);
  assert.match(sameAgeMarkup, /R-A and 1 descendant subclade: 2 subclades in total/);
  assert.match(sameAgeMarkup, /share one rounded Formed estimate/);
  assert.doesNotMatch(markup, /class="formed-branch-ledger formed-branch-tree"/,
    "the result row must stay compact while the full structure is shown in the profile");
  assert.match(markup, /data-open-result-detail="R-A"/,
    "canonical time results must expose their scoped terminal details");
  assert.doesNotMatch(markup, /<a class="subclade-link"/, "branch names are plain text");
  assert.match(markup, /class="table-profile-action table-yfull-action".*?target="_blank"/s,
    "YFull is a distinct, explicitly external action");
  assert.match(markup, /class="mobile-cell-label">Branch</,
    "mobile result cards must label the canonical branch instead of relying on a hidden table head");
  assert.match(markup, /class="mobile-cell-label">Formation estimates</);
  assert.match(markup, /class="mobile-cell-label">From selected date · years</);
  assert.match(markup, /class="mobile-cell-label">Countries</);
  assert.match(markup, /class="mobile-cell-label">Samples <span class="table-sample-scope">\(<span class="table-sample-scope-label">all<\/span>\)<\/span>/);

  const sharedDateBranch = resultRow("R-SHARED", 31, "formed-in-slice");
  sharedDateBranch.node.formed = 6000;
  sharedDateBranch.formedMembers = Array.from({ length: 31 }, (_, index) => {
    const node = index === 0
      ? sharedDateBranch.node
      : { id: `R-SHARED-${index}`, project: "R", formed: 6000, formedKnown: true };
    return { node, path: index === 0 ? [node] : [sharedDateBranch.node, node] };
  });
  sharedDateBranch.formedEvents = [{
    node: sharedDateBranch.node,
    path: [sharedDateBranch.node],
    formedMembers: sharedDateBranch.formedMembers,
    total: 31,
    delta: 500,
    countryCounts: new Map([["AA", 31]]),
    parentEventId: null,
    viaParentId: null,
  }];
  const sharedDateMarkup = renderRows({
    rows: [sharedDateBranch],
    tableRowLimit: 10,
    tableSort: { key: "formed", direction: "desc" },
  }, { ...context, locale: "ru", t: (key) => ru[key] });
  assert.match(sharedDateMarkup, /30 субкладов ниже по дереву. Всего субкладов: 31/,
    "Russian one-date branch copy must count only descendants below the upper result and explain the shared estimate");
  const formedHead = renderTimeTableHead({ key: "total", direction: "desc" }, context);
  assert.equal([...formedHead.matchAll(/<th/g)].length, 6);
  assert.doesNotMatch(formedHead, new RegExp(`>${en.tablePath}`),
    "Formed table must move source paths into branch details");
  assert.match(formedHead, new RegExp(en.tableBranch));
  assert.match(formedHead, new RegExp(en.tableFormedSpan));
  assert.match(formedHead, new RegExp(en.tableDeltaRange));
  const referencedHead = renderTimeTableHead({ key: "delta", direction: "asc" }, { ...context, targetYbp: 5500 });
  assert.match(referencedHead, /class="table-reference-date">5500 ybp</,
    "the delta column must expose its chosen reference date beside the label");

  const formedCsv = resultsCsvText({
    formedRows: [grouped],
    crossingRows: [],
    selectedCountries: ["AA"],
    presenceMode: "any",
    minResultSamples: 0,
    targetYbp: 5500,
    targetYear: "3500",
    targetEra: "BCE",
    macroGroupFilter: null,
    formatCalendar: (value) => `${value} ybp`,
    subcladeUrl: (id) => `https://example.test/${id}`,
  });
  const [formedHeader, formedValues] = formedCsv.split("\n").map((line) => line.split(","));
  assert.equal(formedValues[formedHeader.indexOf("result_identity")], "R-A",
    "Formed CSV identity must be the upper event, not every nested member");
  assert.equal(formedValues[formedHeader.indexOf("formed_group_size")], "2");
  assert.equal(formedValues[formedHeader.indexOf("formed_branch_event_count")], "3");
  assert.equal(formedValues[formedHeader.indexOf("formed_branch_subclade_count")], "4");
  assert.equal(formedValues[formedHeader.indexOf("formed_span_older_ybp")], "6000");
  assert.equal(formedValues[formedHeader.indexOf("formed_span_younger_ybp")], "4700");
  assert.equal(formedValues[formedHeader.indexOf("delta_min_ybp")], "300");
  assert.equal(formedValues[formedHeader.indexOf("delta_max_ybp")], "800");
  assert.match(formedValues[formedHeader.indexOf("formed_branch_event_support")], /R-A: 30 \| R-C: 18 \| R-D: 11/);
  assert.equal(formedValues[formedHeader.indexOf("total_selected")], "30",
    "CSV must export the upper branch evidence once, matching the table");
  assert.equal(formedValues[formedHeader.indexOf("min_samples_basis")],
    "not_applied_in_all_branches_mode");

  const macroI1 = resultRow("I-M253", 8, "formed-in-slice");
  const macroI2 = resultRow("I-M438", 7, "formed-in-slice");
  macroI1.node.project = "I1";
  macroI1.formedMembers[0].node.project = "I1";
  macroI2.node.project = "I2";
  macroI2.formedMembers[0].node.project = "I2";
  const macroMarkup = renderRows({
    rows: [macroI1, macroI2],
    tableRowLimit: 10,
    tableSort: { key: "total", direction: "desc" },
  }, context);
  assert.equal([...macroMarkup.matchAll(/<tr[^>]*data-result-role="formed"[^>]*data-macro-group="I1"/g)].length, 1);
  assert.equal([...macroMarkup.matchAll(/<tr[^>]*data-result-role="formed"[^>]*data-macro-group="I2"/g)].length, 1,
    "I1 and I2 must remain distinct macrogroup identities");
  assert.equal([...macroMarkup.matchAll(/class="row-macro-label"[^>]*>[\s\S]*?I[12]<\/span>/g)].length, 2,
    "each result row must retain its exact project macrogroup without breaking global sorting");
  const macroColors = [...macroMarkup.matchAll(/class="subclade-link" data-macro-group="I[12]" style="--row-color:([^"]+)"/g)]
    .map((match) => match[1]);
  assert.equal(macroColors.length, 2);
  assert.equal(new Set(macroColors).size, 2,
    "I1 and I2 macrogroup subclades must use distinct supplementary colors");

  const macroRHigh = resultRow("R-HIGH", 30, "formed-in-slice");
  const macroIMiddle = resultRow("I-MIDDLE", 20, "formed-in-slice");
  const macroRLow = resultRow("R-LOW", 10, "formed-in-slice");
  macroIMiddle.node.project = "I1";
  macroIMiddle.formedMembers[0].node.project = "I1";
  const interleavedMarkup = renderRows({
    rows: [macroRLow, macroIMiddle, macroRHigh],
    tableRowLimit: 10,
    tableSort: { key: "total", direction: "desc" },
  }, context);
  assert.doesNotMatch(interleavedMarkup, /result-macro-heading|data-result-macro-group/,
    "globally sorted rows must not create repeated pseudo-sections for one macrogroup");
  assert.ok(interleavedMarkup.indexOf("R-HIGH") < interleavedMarkup.indexOf("I-MIDDLE")
    && interleavedMarkup.indexOf("I-MIDDLE") < interleavedMarkup.indexOf("R-LOW"),
  "the rendered row order must match the global sortable-column order promised by aria-sort");
  assert.doesNotMatch(interleavedMarkup, /scope="rowgroup"/,
    "a visual heading inside a shared tbody must not claim an invalid rowgroup scope");

  const crossingContext = { ...context, sliceMode: "crossing" };
  const crossingA = resultRow("R-X", 30, "crossing-through", "R-X1");
  const crossingB = resultRow("R-Y", 10, "crossing-through", "R-Y1");
  crossingA.delta = 900;
  crossingB.delta = 0;
  const crossingMarkup = renderRows({
    rows: [crossingB, crossingA],
    tableRowLimit: 10,
    tableSort: { key: "delta", direction: "asc" },
  }, crossingContext);
  assert.doesNotMatch(crossingMarkup, /formed-branch-trigger|formed-branch-dialog/,
    "Crossing edges must retain their own edge/path presentation");
  assert.ok(crossingMarkup.indexOf("R-X") < crossingMarkup.indexOf("R-Y"),
    "a stale Formed delta sort must normalize to visible support sorting in Crossing");
  const crossingHead = renderTimeTableHead({ key: "delta", direction: "asc" }, crossingContext);
  assert.equal([...crossingHead.matchAll(/<th/g)].length, 6);
  assert.match(crossingHead, new RegExp(en.tablePath));
  assert.doesNotMatch(crossingHead, /data-table-sort="delta"/,
    "Crossing must not offer a sortable column whose cells and CSV value are empty");
  assert.match(crossingHead, /data-table-sort="total"[^>]*>[\s\S]*sort-indicator[^>]*>↓/,
    "Crossing must expose the effective visible sort after leaving Formed delta sorting");
}
