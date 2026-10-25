import type { SignatureRow, TreeIndex } from "../types";

export function signatureOptionsForQuery(value: TreeIndex, query: string): SignatureRow[] {
  const normalized = query.trim().toUpperCase();
  if (!normalized) return value.signatureRows.slice(0, 8);

  // An exact identifier must not disappear behind eight more common prefix matches.
  const exact = value.signatureRows.find((row) => row.node.id.toUpperCase() === normalized);
  const startsWith: SignatureRow[] = exact ? [exact] : [];
  const contains: SignatureRow[] = [];

  for (const row of value.signatureRows) {
    if (row === exact) continue;
    const id = row.node.id.toUpperCase();
    if (id.startsWith(normalized)) {
      startsWith.push(row);
      if (startsWith.length >= 8) break;
    } else if (contains.length < 8 && id.includes(normalized)) {
      contains.push(row);
    }
  }

  return startsWith.length >= 8
    ? startsWith
    : startsWith.concat(contains).slice(0, 8);
}
