export const ANCIENT_URL = "https://hras.yseq.net/data/y_onTheFlyAncient.txt";

// Identifiers are transient join keys only; never serialize or log them.
export function parseAncientIds(text) {
  const ids = new Set();
  for (const line of text.trim().split(/\r?\n/)) {
    const fields = line.split(",");
    if (fields.length < 8 || !fields[0] || !Number.isFinite(Number(fields[5]))) {
      throw new Error("Invalid ancient-sample classification source");
    }
    ids.add(fields[0].trim());
  }
  if (!ids.size) throw new Error("Empty ancient-sample classification source");
  return ids;
}
