import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./runtime.mjs";
import {
  analyzePayload, analysisState, analysisResult, analysisSliceResult,
  fakeWorker, fakeElement, fakeEventTarget, signatureRow, resultRow,
  captureCommittedQuery, provenanceIndex,
} from "./fixtures.mjs";

export async function assertResearchEntityHistoryRestoresContext(createResearchController) {
  const previousWindow = globalThis.window;
  const previousHistory = globalThis.history;
  const previousDocument = globalThis.document;
  const listeners = new Map();
  const pushedStates = [];
  globalThis.window = {
    addEventListener(type, listener) { listeners.set(type, listener); },
  };
  globalThis.history = {
    state: {},
    replaceState(state) { this.state = state; },
    pushState(state) { this.state = state; pushedStates.push(state); },
  };
  globalThis.document = {
    getElementById: () => ({ focus() {} }),
    querySelector: () => null,
  };
  const state = {
    results: [],
    analysisBusy: false,
    researchView: "time",
    researchBusy: false,
    researchError: null,
    profile: null,
    countryEvidence: null,
    countryOverview: null,
    countryEvidenceParentView: "profile",
    signatureSource: null,
    signatureQuery: "",
  };
  const panel = () => ({ hidden: false, classList: { toggle() {} }, querySelector: () => null });
  const tab = (view) => ({
    dataset: { researchView: view },
    classList: { toggle() {} },
    setAttribute() {},
    removeAttribute() {},
  });
  const content = () => ({ innerHTML: "", querySelector: () => null, addEventListener() {},
    replaceChildren() { this.innerHTML = ""; } });
  const elements = {
    timeWorkspace: panel(),
    profileWorkspace: panel(),
    countryEvidenceWorkspace: panel(),
    countryOverviewWorkspace: panel(),
    profileContent: content(),
    countryEvidenceContent: content(),
    countryOverviewContent: content(),
    countryOverviewSelect: { value: "", disabled: false, innerHTML: "" },
    researchViewButtons: [tab("time"), tab("profile"), tab("country-overview")],
  };
  const profile = (id) => ({
    node: { id, project: "R", formed: 5000, formedKnown: true },
    path: [{ id, project: "R", formed: 5000, formedKnown: true }],
    parent: null,
    total: 1,
    countryCounts: new Map([["RUS", 1]]),
    directTotal: 1,
    directCountryCounts: new Map([["RUS", 1]]),
    immediateBranches: [],
    evidenceTree: {
      node: { id, project: "R", formed: 5000, formedKnown: true },
      total: 1, directTotal: 1, countryCounts: new Map([["RUS", 1]]), children: [],
    },
    supportedDescendantCount: 0,
    datedDescendantCount: 0,
  });
  const evidence = (country, anchorId) => ({
    country,
    anchor: { id: anchorId, project: "R", formed: 5000, formedKnown: true },
    path: [],
    total: 1,
    directTotal: 1,
    immediateBranches: [],
    deepestAssignments: [],
  });
  try {
    const controller = createResearchController({
      state,
      elements,
      workerClient: {
        request: async (message) => message.type === "subcladeProfile"
          ? { type: "subcladeProfile", profile: profile(message.clade) }
          : { type: "countryEvidence", evidence: evidence(message.country, message.anchorId) },
      },
      t: (key) => key,
      formatCalendar: String,
      formatNumber: String,
      countryName: (code) => code,
      countryFlag: () => "",
      subcladeUrl: () => "",
      setTargetFromYbp: () => {},
      queueAnalysis: () => {},
      renderSignatureSearch: () => {},
      renderControlTabs: () => {},
      renderSliceCopy: () => {},
    });

    await controller.loadProfile("R-ROOT");
    await controller.loadCountryEvidence("RUS", "R-ROOT");
    await controller.loadProfile("R-CHILD");
    assert.deepEqual(
      pushedStates.map(({ ynodusView, ynodusClade, ynodusCountry, ynodusAnchor }) => ({
        ynodusView, ynodusClade, ynodusCountry, ynodusAnchor,
      })),
      [
        { ynodusView: "profile", ynodusClade: "R-ROOT", ynodusCountry: undefined, ynodusAnchor: undefined },
        { ynodusView: "country", ynodusClade: undefined, ynodusCountry: "RUS", ynodusAnchor: "R-ROOT" },
        { ynodusView: "profile", ynodusClade: "R-CHILD", ynodusCountry: undefined, ynodusAnchor: undefined },
      ],
      "research history must identify the profile or country scope, not only the visible workspace",
    );

    listeners.get("popstate")({
      state: {
        ynodusView: "country",
        ynodusCountry: "RUS",
        ynodusAnchor: "R-ROOT",
      },
    });
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(state.researchView, "country");
    assert.equal(state.countryEvidence?.country, "RUS");
    assert.equal(state.countryEvidence?.anchor.id, "R-ROOT");

    controller.back();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(state.researchView, "profile");
    assert.equal(state.profile?.node.id, "R-ROOT",
      "Back to profile from restored country evidence must return to its anchor profile");
  } finally {
    globalThis.window = previousWindow;
    globalThis.history = previousHistory;
    globalThis.document = previousDocument;
  }
}

export async function assertWorkerResponseAndSupersessionContract(createWorkerClient, crossing) {
  const previousWindow = globalThis.window;
  globalThis.window = {
    setTimeout: () => 1,
    clearTimeout() {},
  };
  const worker = fakeWorker();
  try {
    const client = createWorkerClient(worker, 60_000);
    const firstRequest = client.request(analyzePayload());
    const firstWire = worker.posts[0];
    worker.emit("message", {
      data: {
        id: firstWire.id,
        type: "analyze",
        result: analysisResult(crossing),
      },
    });
    const first = await firstRequest;
    assert.equal(first.type, "analyze");
    assert.deepEqual(first.result.crossing.rows, [crossing]);

    const secondRequest = client.request({ ...analyzePayload(), target: 5600 });
    const secondWire = worker.posts[1];
    worker.emit("message", {
      data: {
        id: secondWire.id,
        type: "analyze",
        result: analysisResult(crossing),
      },
    });
    const second = await secondRequest;
    assert.equal(second.type, "analyze");
    assert.deepEqual(second.result.crossing.rows, [crossing]);

    const superseded = client.request({ ...analyzePayload(), target: 5700 });
    const latest = client.request({ ...analyzePayload(), target: 5800 });
    await assert.rejects(superseded, /superseded/);
    const latestWire = worker.posts.at(-1);
    worker.emit("message", {
      data: {
        id: latestWire.id,
        type: "analyze",
        result: analysisResult(crossing),
      },
    });
    await latest;

    const supersededLoad = client.request({ type: "load", url: "old-index.json" });
    const latestLoad = client.request({ type: "load", url: "new-index.json" });
    await assert.rejects(supersededLoad, /superseded/,
      "a newer dataset load must reject the older pending load");
    const latestLoadWire = worker.posts.at(-1);
    worker.emit("message", {
      data: {
        id: latestLoadWire.id,
        type: "load",
        index: { countries: [] },
      },
    });
    await latestLoad;

    let timeoutCallback;
    globalThis.window.setTimeout = (callback) => {
      timeoutCallback = callback;
      return 2;
    };
    const timedOutLoad = client.request({ type: "load", url: "slow-index.json" });
    const timedOutWire = worker.posts.at(-1);
    timeoutCallback();
    await assert.rejects(timedOutLoad, /timed out/);
    assert.deepEqual(worker.posts.at(-1), {
      id: timedOutWire.id + 1,
      type: "cancelLoad",
      loadId: timedOutWire.id,
    }, "a timed-out dataset load must be invalidated inside the worker");
  } finally {
    globalThis.window = previousWindow;
  }
}

export function assertLatestOnlySchedulerContract(createLatestOnlyScheduler) {
  const flushes = [];
  const analyzed = [];
  const scheduler = createLatestOnlyScheduler(
    (value) => analyzed.push(value),
    (flush) => flushes.push(flush),
  );
  scheduler.enqueue({ id: 1 });
  scheduler.enqueue({ id: 2 });
  scheduler.enqueue({ id: 3 });
  assert.equal(flushes.length, 1, "a queued analyze burst must schedule one worker flush");
  flushes.shift()();
  assert.deepEqual(analyzed.map(({ id }) => id), [3], "worker must start only the latest queued analyze");
}

export function assertWholeCountryOverviewPartition(countryOverviewForCountry) {
  const node = (id, project) => ({ id, project, formed: 5000, formedKnown: true });
  const root = node("ROOT", "ROOT");
  const records = [
    { country: "AAA", count: 3, path: [root, node("A-ONE", "A")] },
    { country: "AAA", count: 4, path: [root, node("A-TWO", "A")] },
    { country: "AAA", count: 2, path: [root, node("B-ONE", "B")] },
  ];
  const overview = countryOverviewForCountry({
    samplesByCountry: new Map([["AAA", records]]),
  }, "AAA");
  assert.equal(overview.total, 9);
  assert.deepEqual(overview.groups.map(({ project, total }) => [project, total]), [["A", 7], ["B", 2]]);
  assert.equal(overview.groups.reduce((sum, group) => sum + group.total, 0), overview.total,
    "disjoint terminal-project groups must add up exactly once to the country total");
  assert.deepEqual(overview.assignments.map(({ node: assignment, total }) => [assignment.id, total]),
    [["A-TWO", 4], ["A-ONE", 3], ["B-ONE", 2]]);
  assert.equal(overview.roots.length, 1);
  assert.equal(overview.roots[0].total, 9);
  assert.equal(overview.roots[0].directTotal, 0);
  assert.deepEqual(overview.roots[0].children.map(child => [child.node.id, child.total]),
    [["A-TWO", 4], ["A-ONE", 3], ["B-ONE", 2]], "retain real cross-project edges");

  const a = node("A-ROOT", "A"), child = node("A-CHILD", "A");
  const b = { ...node("B-ROOT", "B"), formed: 0, formedKnown: false };
  const partition = countryOverviewForCountry({ samplesByCountry: new Map([["AAA", [
    { country: "AAA", count: 2, path: [a] },
    { country: "AAA", count: 3, path: [a, child] },
    { country: "AAA", count: 4, path: [a, child] },
    { country: "AAA", count: 5, path: [b] },
  ]]]) }, "AAA");
  assert.equal(partition.total, 14);
  assert.equal(partition.roots.length, 2, "unrelated source roots must remain separate");
  const terminalTotals = new Map();
  const pending = [...partition.roots];
  while (pending.length) {
    const branch = pending.pop();
    assert.equal(branch.directTotal + branch.children.reduce((sum, child) => sum + child.total, 0),
      branch.total, "direct assignments plus immediate children partition each country branch exactly once");
    assert.deepEqual([...branch.countryCounts], [["AAA", branch.total]]);
    if (branch.directTotal) terminalTotals.set(branch.node.id, branch.directTotal);
    pending.push(...branch.children);
  }
  assert.deepEqual([...terminalTotals].sort(), [["A-CHILD", 7], ["A-ROOT", 2], ["B-ROOT", 5]]);
  assert.equal(partition.roots.find(root => root.node.id === "B-ROOT").node.formedKnown, false);
  assert.equal(partition.roots.reduce((sum, root) => sum + root.total, 0), partition.total);
  assert.equal(countryOverviewForCountry({ samplesByCountry: new Map() }, "AAA"), null);
  const unique = node("C-UNIQUE", "C"), separate = node("D-SEPARATE", "D");
  const comparison = countryOverviewForCountry({ samplesByCountry: new Map([
    ["AAA", records], ["BBB", [
      {country:"BBB", count:5, path:[root,node("A-ONE","A")]},
      {country:"BBB", count:6, path:[root,unique]},
      {country:"BBB", count:2, path:[separate]},
    ]],
  ]) }, "AAA", ["BBB","AAA","BBB"]);
  assert.equal(comparison.total,22,"duplicate country choices must not duplicate records");
  assert.deepEqual([...comparison.countryCounts],[["AAA",9],["BBB",13]]);
  const comparisonOnly = countryOverviewForCountry({ samplesByCountry: new Map([["BBB", records.map(record=>({...record,country:"BBB"}))]]) }, "AAA", ["BBB"]);
  assert.equal(comparisonOnly.total, 9, "a country with no records in the sample-type scope must not hide comparison-country records");
  assert.equal(comparisonOnly.countryCounts.get("AAA"), 0);
  const emptyKnown = countryOverviewForCountry({ samplesByCountry: new Map(), countries: new Map([["AAA",0]]) }, "AAA");
  assert.equal(emptyKnown.total, 0, "a known country with no records keeps an empty, recoverable overview");
  assert.deepEqual(emptyKnown.roots, []);
  assert.equal(comparison.roots.length,2,"a comparison preserves separate source roots");
  assert.equal(comparison.roots.find(item=>item.node.id==="ROOT").children.find(item=>item.node.id==="C-UNIQUE").total,6,
    "a comparison adds branches exclusive to the other country");
  assert.equal(comparison.roots.reduce((sum,item)=>sum+item.total,0),comparison.total);
  assert.equal(comparison.groups.reduce((sum,item)=>sum+item.total,0),comparison.total);
  for(const branch of comparison.roots.flatMap(root=>[root,...root.children])) {
    assert.equal([...branch.countryCounts.values()].reduce((sum,n)=>sum+n,0),branch.total);
    assert.equal(branch.directTotal+branch.children.reduce((sum,item)=>sum+item.total,0),branch.total);
  }
}
