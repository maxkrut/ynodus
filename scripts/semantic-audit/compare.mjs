import assert from "node:assert/strict";
import { pairs, sorted, referenceQuery, referenceProfile } from "./reference.mjs";

const base = (row) => ({ id: row.node.id, path: row.path.map((n) => n.id), age: row.node.formed,
  total: row.total, counts: pairs(row.countryCounts), delta: row.delta });
const members = (rows) => sorted(rows.map((m) => ({ id: m.node.id, path: m.path.map((n) => n.id) })));
export const formedRows = (rows) => sorted(rows.map((row) => ({ ...base(row),
  below: pairs(row.belowMinimumCountryCounts ?? new Map()),
  members: members(row.formedMembers), events: sorted(row.formedEvents.map((e) => ({ ...base(e),
    members: members(e.formedMembers), parentEventId: e.parentEventId, viaParentId: e.viaParentId }))),
  span: row.formedSpan, deltaRange: row.deltaRange })));
export const crossingRows = (rows) => sorted(rows.map((r) => ({ ...base(r),
  below: pairs(r.belowMinimumCountryCounts ?? new Map()),
  id: `${r.node.id}>${r.crossingChild.id}`, parent: r.node.id, child: r.crossingChild.id,
  childAge: r.crossingChild.formed })));

export function checkQuery(api, data, query, index = api.buildIndex(data)) {
  const expected = referenceQuery(data, query);
  const actual = api.collectTimeMatchResults(index, query);
  assert.deepEqual(formedRows(actual.formed.rows), expected.formed, "Formed differs from independent model");
  assert.deepEqual(crossingRows(actual.crossing.rows), expected.crossing, "Crossing differs from independent model");
  assert.equal(actual.formed.matchingSamples, expected.formedSupport, "unique Formed support");
  assert.equal(actual.crossing.matchingSamples, expected.crossingSupport, "unique Crossing support");
  assert.deepEqual(sorted(actual.formed.densityRows.map((r) => ({ id: r.node.id, age: r.node.formed,
    total: r.total, parent: r.parentId }))), expected.density, "density evidence");
  const raw = api.collectRowsAtTarget(index, { ...query, sliceMode: "crossing" });
  assert.deepEqual(crossingRows(raw.rows), expected.rawCrossing, "raw Crossing classification");
  assert.equal(raw.matchingSamples, expected.rawCrossingSupport, "unique raw Crossing support");
  return { actual, expected };
}

export function checkProfile(api, data, id, index = api.buildIndex(data)) {
  const expected = referenceProfile(data, id), p = api.subcladeProfileForClade(index, id);
  if (!expected) { assert.equal(p, null); return; }
  const branch = (n) => ({ id: n.node.id, total: n.total, counts: pairs(n.countryCounts) });
  const tree = [], stack = [p.evidenceTree];
  while (stack.length) {
    const n = stack.pop();
    assert.equal(n.total, n.directTotal + n.children.reduce((s, c) => s + c.total, 0), "profile additive partition");
    tree.push({ ...branch(n), directTotal: n.directTotal, children: n.children.map((c) => c.node.id).sort() });
    stack.push(...n.children);
  }
  assert.deepEqual({ ...branch(p), path: p.path.map((n) => n.id), parent: p.parent?.id ?? null,
    directTotal: p.directTotal, directCounts: pairs(p.directCountryCounts),
    branches: sorted(p.immediateBranches.map(branch)), tree: sorted(tree),
    supported: p.supportedDescendantCount, dated: p.datedDescendantCount }, expected);
  for (const country of data.countryCodes) {
    const result = api.countryEvidenceForBranch(index, country, id);
    const total = expected.counts.find(([c]) => c === country)?.[1] ?? 0;
    if (!total) { assert.equal(result, null); continue; }
    assert.equal(result.total, total);
    assert.equal(result.directTotal, expected.directCounts.find(([c]) => c === country)?.[1] ?? 0);
    assert.deepEqual(sorted(result.immediateBranches.map(branch)), sorted(expected.branches
      .filter((b) => b.counts.some(([c]) => c === country)).map((b) => ({ id: b.id,
        total: b.counts.find(([c]) => c === country)[1], counts: b.counts.filter(([c]) => c === country) }))));
    const terminal = new Map();
    for (const [n, c, count] of data.samples) if (data.countryCodes[c] === country && expected.tree.some((t) => t.id === data.nodeIds[n])) {
      const key = data.nodeIds[n]; terminal.set(key, (terminal.get(key) ?? 0) + count);
    }
    assert.deepEqual(pairs(new Map(result.deepestAssignments.map((a) => [a.node.id, a.total]))), pairs(terminal));
  }
}
