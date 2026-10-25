import assert from "node:assert/strict";
import { loadModule } from "./runtime.mjs";

export async function assertHistoryNamespaceMigration() {
  const { normalizeHistoryState } = await loadModule("app/history-state.ts");
  const { parseHistoryRoute, writeRouteHistory } = await loadModule("app/research-history.ts");
  const { readNavigationSnapshot } = await loadModule("app/navigation-snapshot.ts");
  const saved = readNavigationSnapshot({ scroll: 120, time: { tableSort: { key: "total", direction: "desc" } },
    tree: { country: "RUS", query: "R-SYN", opened: ["R-SYN-ROOT"], macro: "R1a", browse: true, searchLimit: 40,
      closed: ["R-SYN-CHILD"], countries: ["RUS"], treeScrollLeft: 12, offset: 100 },
    branchTree: { anchor: "R-SYN-ROOT", mode: "tree", rows: 20, searchLimit: 40,
      opened: ["R-SYN-ROOT"], limits: [["R-SYN-ROOT", 40]], query: "R-SYN", treeScrollLeft: 24 },
    profileExplorer: { anchor: "R-SYN-ROOT", selected: "R-SYN-CHILD", mode: "tree", rows: 100,
      closed: ["R-SYN-CHILD"], countries: ["RUS"], query: "R-SYN", treeScrollLeft: 36, inspectorOpen: true } });
  assert.deepEqual(saved.tree.closed, ["R-SYN-CHILD"]);
  assert.equal(saved.tree.macro, "R1a");
  assert.equal(saved.tree.browse, true);
  assert.deepEqual(saved.tree.countries, ["RUS"]);
  assert.equal(saved.tree.offset, 100);
  assert.equal(saved.tree.treeScrollLeft, 12);
  assert.deepEqual(saved.branchTree.opened, ["R-SYN-ROOT"]);
  assert.deepEqual(saved.branchTree.limits, [["R-SYN-ROOT", 40]]);
  assert.equal(saved.branchTree.query, "R-SYN");
  assert.equal(saved.branchTree.treeScrollLeft, 24);
  assert.equal(saved.profileExplorer.selected, "R-SYN-CHILD");
  assert.deepEqual(saved.profileExplorer.countries, ["RUS"]);
  assert.deepEqual(saved.profileExplorer.closed, ["R-SYN-CHILD"]);
  assert.equal(saved.profileExplorer.treeScrollLeft, 36);
  assert.equal(saved.profileExplorer.inspectorOpen, true);
  for (const state of [saved.tree, saved.branchTree, saved.profileExplorer]) {
    assert.ok(!("mode" in state) && !("searchLimit" in state), "retired controls do not survive snapshot normalization");
  }
  assert.deepEqual(saved.tree.opened, ["R-SYN-ROOT"], "compact trees preserve explicit expansion");
  assert.ok(!("rows" in saved.branchTree));
  const route = { view: "profile", clade: "R-SYN-CHILD", detail: { mode: "crossing", countries: ["RUS"], parentId: "R-SYN-ROOT" } };
  const entry = { version: 1, owner: "synthetic-owner", index: 2, route,
    origin: { index: 1, route: { view: "time" } },
    snapshot: { scroll: 120, tables: { formed: { macroGroup: "R" } } }, workspaces: {} };
  const state = { legacyAppView: "profile", legacyAppClade: route.clade, legacyAppDetail: "crossing",
    legacyAppDetailParent: "R-SYN-ROOT", legacyAppScope: ["RUS"], legacyAppNavigation: entry, unrelated: "preserve" };
  const before = structuredClone(state), normalized = normalizeHistoryState(state);
  assert.deepEqual(state, before, "migration must not mutate native history objects");
  assert.deepEqual(parseHistoryRoute(state), route);
  assert.equal(normalized.ynodusNavigation, entry, "owner, origins and presentation snapshots survive migration");
  assert.equal(normalized.unrelated, "preserve");
  assert.ok(Object.keys(normalized).every(key => !key.startsWith("legacyApp")));
  assert.deepEqual(normalizeHistoryState(normalized), normalized);
  assert.equal(parseHistoryRoute({ ...state, legacyAppNavigation: { ...entry, version: 2 } }), null);
  assert.equal(parseHistoryRoute({ ...state, otherView: "profile", otherNavigation: entry }), null, "ambiguous namespaces fail closed");
  assert.equal(parseHistoryRoute({ ...state, ynodusView: "invalid" }), null, "current namespace never falls back to stale fields");
  assert.deepEqual(parseHistoryRoute({ ...state, legacyAppScope: [] }), { view: "time" }, "incomplete terminal details remain fail-closed");
  const previousHistory = globalThis.history, previousLocation = globalThis.location;
  try {
    globalThis.history = { state, replaceState(value) { this.state = value; } };
    globalThis.location = new URL("https://example.test/?view=profile&clade=R-SYN-CHILD");
    writeRouteHistory(route, "replace");
    assert.equal(history.state.ynodusNavigation, entry);
    assert.equal(history.state.unrelated, "preserve");
    assert.ok(Object.keys(history.state).every(key => !key.startsWith("legacyApp")));
  } finally {
    if (previousHistory === undefined) delete globalThis.history; else globalThis.history = previousHistory;
    if (previousLocation === undefined) delete globalThis.location; else globalThis.location = previousLocation;
  }
}
