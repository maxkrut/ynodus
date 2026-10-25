const DISPLAY_PROJECT_FROM_ID = {
  A00: "A00",
  "A0-T": "A0-T",
  "F-Y27277": "F",
  "K-Y28299": "K",
};

export function parseReferenceTree(text) {
  const parsed = JSON.parse(text);
  const nodes = {};

  function visit(entry, parentId) {
    if (!entry || typeof entry !== "object") return;
    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    const formed = parseNumeric(entry.formed);
    let nextParent = parentId;

    if (id) {
      nodes[id] = {
        id,
        project: inferProjectFromId(id),
        parent: parentId,
        formed,
      };
      nextParent = id;
    }

    const children = Array.isArray(entry.children) ? entry.children : [];
    for (const child of children) visit(child, nextParent);
  }

  visit(parsed, null);
  return nodes;
}

export function mergeNodes(hrasTree, referenceTree) {
  const ids = [...new Set([...Object.keys(referenceTree), ...Object.keys(hrasTree)])]
    .sort((a, b) => a.localeCompare(b));
  const merged = {};

  for (const id of ids) {
    const reference = referenceTree[id] ?? null;
    const hras = hrasTree[id] ?? null;
    merged[id] = {
      id,
      project: hras?.project ?? reference?.project ?? inferProjectFromId(id),
      // A reference root is an explicit boundary, not missing parent data.
      parent: reference ? reference.parent : hras?.parent ?? null,
      formed: reference?.formed ?? hras?.formed ?? null,
    };
  }

  for (const node of Object.values(merged)) {
    if (node.parent && !merged[node.parent]) {
      throw new Error(`Merged node ${node.id} references missing parent ${node.parent}.`);
    }
  }

  return merged;
}

export function summarizeMerge(hrasTree, referenceTree, mergedTree) {
  let referenceParentUsed = 0;
  let hrasParentFallback = 0;
  let referenceTimingUsed = 0;
  let hrasTimingFallback = 0;

  for (const id of Object.keys(mergedTree)) {
    const merged = mergedTree[id];
    const reference = referenceTree[id] ?? null;
    const hras = hrasTree[id] ?? null;
    if (merged.parent && merged.parent === reference?.parent) referenceParentUsed += 1;
    else if (merged.parent && merged.parent === hras?.parent) hrasParentFallback += 1;
    if (merged.formed !== null && merged.formed === reference?.formed) referenceTimingUsed += 1;
    else if (merged.formed !== null && merged.formed === hras?.formed) hrasTimingFallback += 1;
  }

  return {
    strategy: "reference-structure-with-hras-samples",
    hrasNodeCount: Object.keys(hrasTree).length,
    referenceNodeCount: Object.keys(referenceTree).length,
    mergedNodeCount: Object.keys(mergedTree).length,
    referenceParentUsed,
    hrasParentFallback,
    referenceTimingUsed,
    hrasTimingFallback,
  };
}

function parseNumeric(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized === "-") return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function inferProjectFromId(id) {
  if (!id) return "Y";
  const explicit = DISPLAY_PROJECT_FROM_ID[id];
  if (explicit) return explicit;
  const match = id.match(/^[A-Z]+(?:\d+)?/);
  return match?.[0] ?? "Y";
}
