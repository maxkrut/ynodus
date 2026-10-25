// Independent specification model: downward graph components and postorder sums.
// No production imports. Zero is the transport's unknown-date sentinel.
export const pairs = (map) => [...map].filter(([, n]) => n > 0).sort(([a], [b]) => a.localeCompare(b));
export const sorted = (rows) => rows.sort((a, b) => a.id.localeCompare(b.id));

function forest(data, selected = data.countryCodes) {
  const selectedSet = new Set(selected);
  const nodes = data.nodes.map(([, parent, age], i) => ({
    i, id: data.nodeIds[i], parent, age, known: age !== null && age > 0,
    children: [], direct: new Map(), counts: new Map(), path: [], depth: 0,
  }));
  const roots = [];
  for (const node of nodes) {
    if (node.parent < 0) roots.push(node.i);
    else nodes[node.parent].children.push(node.i);
  }
  for (const [i, countryIndex, count] of data.samples) {
    const code = data.countryCodes[countryIndex];
    if (selectedSet.has(code)) nodes[i].direct.set(code, (nodes[i].direct.get(code) ?? 0) + count);
  }
  const order = [], stack = [...roots];
  while (stack.length) {
    const i = stack.pop(), node = nodes[i];
    node.path = [...(node.parent < 0 ? [] : nodes[node.parent].path), node.id];
    node.depth = node.path.length;
    order.push(i);
    stack.push(...node.children);
  }
  for (const i of [...order].reverse()) {
    const node = nodes[i];
    node.counts = new Map(node.direct);
    for (const child of node.children) for (const [code, count] of nodes[child].counts) {
      node.counts.set(code, (node.counts.get(code) ?? 0) + count);
    }
    node.total = [...node.counts.values()].reduce((a, b) => a + b, 0);
    node.directTotal = [...node.direct.values()].reduce((a, b) => a + b, 0);
  }
  return { nodes, roots, order };
}

function components(items, adjacent) {
  const remaining = new Set(items), groups = [];
  while (remaining.size) {
    const queue = [remaining.values().next().value], group = [];
    remaining.delete(queue[0]);
    for (let k = 0; k < queue.length; k++) {
      const i = queue[k];
      group.push(i);
      for (const j of adjacent(i)) if (remaining.delete(j)) queue.push(j);
    }
    groups.push(group);
  }
  return groups;
}

function uniqueSupport(model, endpoints) {
  const covered = new Set(), ids = new Set(endpoints);
  let total = 0;
  for (const i of model.order) {
    const node = model.nodes[i];
    if (ids.has(i) || covered.has(node.parent)) {
      covered.add(i);
      total += node.directTotal;
    }
  }
  return total;
}

export function referenceQuery(data, query) {
  const selected = [...new Set(query.selectedCountries)].filter((code) => data.countryCodes.includes(code));
  const model = forest(data, selected), { nodes } = model;
  const minimum = Math.max(1, Math.round(query.minSamples));
  const counts = (node) => pairs(node.counts);
  const rule = (endpoints) => {
    const covered = new Set(), totals = new Map();
    for (const i of model.order) {
      const node = nodes[i];
      if (!endpoints.has(i) && !covered.has(node.parent)) continue;
      covered.add(i);
      for (const [code, count] of node.direct) totals.set(code, (totals.get(code) ?? 0) + count);
    }
    const required = query.presenceMode === "any" || query.minSamples === 0
      ? selected : selected.filter(code => (totals.get(code) ?? 0) >= minimum);
    return {
      below: node => query.presenceMode === "any" ? [] : counts(node).filter(([code]) => !required.includes(code)),
      qualified: node => required.length > 0 && (query.presenceMode === "any"
        ? required.some(code => node.counts.has(code)) : required.every(code => node.counts.has(code))),
    };
  };
  const candidates = nodes.filter((n) => n.known && n.total > 0 && Math.abs(n.age - query.target) <= query.maxDeltaYbp);
  const { below, qualified } = rule(new Set(candidates.map(n => n.i)));
  const densityQualified = (node) => {
    let root = node;
    while (nodes[root.parent]?.known && nodes[root.parent].age === root.age) root = nodes[root.parent];
    return qualified(root);
  };
  const groups = components(candidates.map((n) => n.i), (i) =>
    [nodes[i].parent, ...nodes[i].children].filter((j) => j >= 0 && nodes[j].age === nodes[i].age));
  const events = groups.map((members) => {
    const root = members.reduce((a, b) => nodes[a].depth < nodes[b].depth ? a : b);
    return { root, members };
  }).filter(({ root }) => qualified(nodes[root]));
  const byMember = new Map();
  events.forEach((e, i) => e.members.forEach((m) => byMember.set(m, i)));
  const eventParent = events.map((e) => byMember.get(nodes[e.root].parent));
  const eventChildren = events.map(() => []);
  eventParent.forEach((p, i) => { if (p !== undefined) eventChildren[p].push(i); });
  const branches = components(events.map((_, i) => i), (i) =>
    [...eventChildren[i], ...(eventParent[i] === undefined ? [] : [eventParent[i]])]);
  const base = (i) => ({ id: nodes[i].id, path: nodes[i].path, age: nodes[i].age,
    total: counts(nodes[i]).reduce((sum, [, count]) => sum + count, 0), counts: counts(nodes[i]), delta: Math.abs(nodes[i].age - query.target) });
  const memberRows = (indices) => sorted(indices.map((i) => ({ id: nodes[i].id, path: nodes[i].path })));
  const formedEndpoints = [];
  const formed = sorted(branches.map((indices) => {
    const top = indices.find((i) => eventParent[i] === undefined), root = events[top].root;
    formedEndpoints.push(root);
    const eventRows = sorted(indices.map((i) => {
      const e = events[i], p = eventParent[i];
      return { ...base(e.root), members: memberRows(e.members),
        parentEventId: p === undefined ? null : nodes[events[p].root].id,
        viaParentId: p === undefined ? null : nodes[nodes[e.root].parent].id };
    }));
    const ages = eventRows.map((e) => e.age), deltas = eventRows.map((e) => e.delta);
    return { ...base(root), below: below(nodes[root]), members: memberRows(events[top].members), events: eventRows,
      span: { olderYbp: Math.max(...ages), youngerYbp: Math.min(...ages) },
      deltaRange: { minYbp: Math.min(...deltas), maxYbp: Math.max(...deltas) } };
  }));
  const crossingEndpoints = [], rawCrossing = [];
  const crossingCandidates = nodes.filter(child => {
    const parent = nodes[child.parent];
    return child.total > 0 && parent?.known && child.known
      && query.target >= Math.min(child.age, parent.age) && query.target <= Math.max(child.age, parent.age);
  });
  const crossingRule = rule(new Set(crossingCandidates.map(n => n.i)));
  for (const child of crossingCandidates) {
    const parent = nodes[child.parent];
    if (!crossingRule.qualified(child)) continue;
    if (query.target < Math.min(child.age, parent.age) || query.target > Math.max(child.age, parent.age)) continue;
    const row = { ...base(parent.i), id: `${parent.id}>${child.id}`, parent: parent.id, child: child.id,
      childAge: child.age, path: child.path, total: counts(child).reduce((sum, [, count]) => sum + count, 0), counts: counts(child), below: crossingRule.below(child) };
    rawCrossing.push(row);
    if (!byMember.has(child.i) && !byMember.has(parent.i)) crossingEndpoints.push(child.i);
  }
  const crossingIds = new Set(crossingEndpoints.map((i) => nodes[i].id));
  return { formed, crossing: sorted(rawCrossing.filter((r) => crossingIds.has(r.child))),
    rawCrossing: sorted(rawCrossing), formedSupport: uniqueSupport(model, formedEndpoints),
    crossingSupport: uniqueSupport(model, crossingEndpoints),
    rawCrossingSupport: uniqueSupport(model, rawCrossing.map((r) => data.nodeIds.indexOf(r.child))),
    density: sorted(nodes.filter((n) => n.known && n.total > 0 && densityQualified(n)).map((n) => ({
      id: n.id, age: n.age, total: n.total, parent: nodes[n.parent]?.id ?? null,
    }))) };
}

export function referenceProfile(data, anchor) {
  const { nodes } = forest(data), root = nodes.find((n) => n.id === anchor);
  if (!root?.total) return null;
  const subtree = [], stack = [root.i];
  while (stack.length) {
    const node = nodes[stack.pop()];
    if (!node.total) continue;
    subtree.push(node);
    stack.push(...node.children);
  }
  const branch = (n) => ({ id: n.id, total: n.total, counts: pairs(n.counts) });
  return { ...branch(root), path: root.path, parent: nodes[root.parent]?.id ?? null,
    directTotal: root.directTotal, directCounts: pairs(root.direct),
    branches: sorted(root.children.map((i) => nodes[i]).filter((n) => n.total).map(branch)),
    tree: sorted(subtree.map((n) => ({ ...branch(n), directTotal: n.directTotal,
      children: n.children.filter((i) => nodes[i].total).map((i) => nodes[i].id).sort() }))),
    supported: subtree.length - 1, dated: subtree.filter((n) => n !== root && n.known).length };
}
