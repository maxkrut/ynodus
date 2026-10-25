// A date is a release date only when the pinned commit explicitly names this version.
function parseReferenceRelease(commit, version, url) {
  const prefix = `Added YTree version ${version} (`;
  const message = commit?.commit?.message;
  const end = typeof message === "string" ? message.indexOf(")", prefix.length) : -1;
  const dateText = message?.startsWith(prefix) && end > prefix.length ? message.slice(prefix.length, end) : null;
  const timestamp = dateText ? Date.parse(dateText + " UTC") : NaN;
  return Number.isFinite(timestamp)
    ? { date: new Date(timestamp).toISOString().slice(0, 10), sourceUrl: url }
    : null;
}
export async function fetchReferenceRelease(referenceRoot, version) {
  const sha = referenceRoot.split("/").filter(Boolean).at(-1);
  const url = "https://api.github.com/repos/YFullTeam/YTree/commits/" + sha;
  const response = await fetch(url, { headers: { "User-Agent": "yNodus" }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error("Cannot verify reference release date: HTTP " + response.status);
  return parseReferenceRelease(await response.json(), version, url);
}
