import { escapeHtml } from "../shared/html";
import type { Locale, TreeIndexSummary as TreeIndex } from "../shared/types";
import { APP_VERSION } from "./constants";
import { formatDate, formatMachineDate } from "./format";
import type { TextKey } from "./i18n";
import { githubIconSvg } from "./icons";
import { renderAnnotation } from "./annotation-markup";

const APP_LICENSE_URL = "./legal/LICENSE.txt";
const SOURCE_LEDGER_URL = "./legal/NOTICE.txt";
const RUNTIME_DATA_URL = "./data/hras-index.json";
const HRAS_URL = "https://hras.yseq.net/";
const HRAS_MANIFEST_URL = "https://hras.yseq.net/data/manifest";
const HRAS_REPOSITORY_URL = "https://github.com/hprovyn/hras";
const HRAS_LICENSE_URL = "https://github.com/hprovyn/hras/blob/main/LICENSE";
const YFULL_REPOSITORY_URL = "https://github.com/YFullTeam/YTree";
const YFULL_VERSION_URL = "https://raw.githubusercontent.com/YFullTeam/YTree/master/current_version.txt";
const YFULL_TREE_URL = "https://www.yfull.com/tree/";
const YFULL_LICENSE_URL = "https://github.com/YFullTeam/YTree/blob/master/LICENSE.md";
const APP_REPOSITORY_URL = "https://github.com/maxkrut/ynodus";

type SourceRenderContext = {
  t: (key: TextKey) => string;
  locale: Locale;
  loadFailed?: boolean;
};

export function renderProvenanceNotes(index: TreeIndex | null, { t, locale }: SourceRenderContext): string {
  const formatCount = new Intl.NumberFormat(locale).format;
  const sampleCoverage = index?.manifestSampleCount == null ? "" :
    `<div class="provenance-sample-coverage"><dl class="annotation-facts"><div><dt>${escapeHtml(t("sourceLocalCount"))}</dt><dd>${escapeHtml(formatCount(index.snapshotSampleCount ?? index.sampleCount))}</dd></div><div><dt>${escapeHtml(t("sourcePublisherCount"))}</dt><dd>${escapeHtml(formatCount(index.manifestSampleCount))}</dd></div></dl>${index.manifestSampleCount === (index.snapshotSampleCount ?? index.sampleCount) ? "" : `<p>${escapeHtml(t("sourceSampleDifferenceUnknown"))}</p>`}</div>`;
  return sampleCoverage;
}

function repositoryLink(url: string): string {
  const path = url.replace("https://github.com/", "");
  return `<a class="provenance-repository" href="${escapeHtml(url)}" target="_blank" rel="noreferrer" aria-label="GitHub: ${escapeHtml(path)}">${githubIconSvg()}<span>${escapeHtml(path)}</span></a>`;
}

function normalizedVersion(marker: string): string | null {
  const value = marker.trim().replace(/^v/i, "");
  return /^\d+(?:\.\d+)+$/.test(value)
    ? value.split(".").map(part => part.replace(/^0+(?=\d)/, "")).join(".") : null;
}

export function renderProvenanceStrip(
  index: TreeIndex | null,
  context: SourceRenderContext,
): string {
  const { locale, t } = context;
  const hrasMarker = index?.version ?? "-";
  const yfullMarker = index?.officialVersion ?? "-";
  const hrasVersion = normalizedVersion(hrasMarker);
  const yfullVersion = normalizedVersion(yfullMarker);
  const status = hrasVersion && yfullVersion
    ? (hrasVersion === yfullVersion ? "matching" : "different") : "unknown";
  const statusLabel = status === "matching" ? "sourceVersionsMatch"
    : status === "different" ? "sourceVersionsDiffer" : "sourceRolesNote";
  const missingDate = t(context.loadFailed ? "metadataUnavailable" : "loadingMetadata");
  const hrasDate = index?.computedDate
    ? formatDate(index.computedDate, locale)
    : missingDate;
  const generatedDate = index?.generatedAt
    ? formatDate(index.generatedAt, locale)
    : missingDate;
  const referenceDate = index?.referenceRelease?.date;
  const referenceDateTime = referenceDate ? ` datetime="${escapeHtml(formatMachineDate(referenceDate) ?? "")}"` : "";
  const displayVersion = APP_VERSION.replace(/^v/, "").split(".").slice(0, 2).join(".");
  const hrasMachineDate = index?.computedDate ? formatMachineDate(index.computedDate) : null;
  const generatedMachineDate = index?.generatedAt ? formatMachineDate(index.generatedAt) : null;
  const hrasDateTime = hrasMachineDate ? ` datetime="${escapeHtml(hrasMachineDate)}"` : "";
  const generatedDateTime = generatedMachineDate
    ? ` datetime="${escapeHtml(generatedMachineDate)}"`
    : "";
  const hrasSourceUrl = index?.sourceUrl ?? HRAS_URL;
  const hrasManifestUrl = index?.sourceManifestUrl ?? HRAS_MANIFEST_URL;
  const link = (url: string, label: string, title = "") => `<a href="${escapeHtml(url)}" tabindex="0" target="_blank" rel="noreferrer"${title ? ` title="${escapeHtml(title)}"` : ""}>${escapeHtml(label)}</a>`;
  const facts = [
    { key: "hras", name: "HRAS/YSEQ", url: hrasSourceUrl, accessibleName: t("hrasSnapshot"),
      role: t("hrasRole"), marker: hrasMarker.replace(/^v/i, ""), date: hrasDate, dateTime: hrasDateTime, dateLabel: t("sourceComputedDate"),
      links: [link(hrasSourceUrl, t("sourceLinkShort")), link(hrasManifestUrl, t("dataManifestShort")),
        link(HRAS_LICENSE_URL, t("codeLicenseShort"), `${t("sourceCodeLicense")}: Apache-2.0`), repositoryLink(HRAS_REPOSITORY_URL)].join("") },
    { key: "yfull", name: "YFull / YTree", url: YFULL_TREE_URL, accessibleName: t("yfullTreeMarker"),
      role: t("yfullRole"), marker: yfullMarker, date: referenceDate ? formatDate(referenceDate, locale) : t("metadataUnavailable"), dateTime: referenceDateTime, dateLabel: t("sourceVersionDate"),
      links: [link(YFULL_TREE_URL, t("treeLinkShort")), link(YFULL_VERSION_URL, t("markerLinkShort")),
        link(YFULL_LICENSE_URL, "CC BY 4.0", `${t("dataLicense")}: CC BY 4.0`), repositoryLink(YFULL_REPOSITORY_URL)].join("") },
    { key: "app", name: "yNodus", url: SOURCE_LEDGER_URL, accessibleName: "yNodus",
      role: t("appRole"), marker: displayVersion, date: generatedDate, dateTime: generatedDateTime, dateLabel: t("dataUpdated"),
      links: [link(RUNTIME_DATA_URL, t("datasetLinkShort")), link(SOURCE_LEDGER_URL, t("sourceManifestShort")),
        link(APP_LICENSE_URL, "Apache-2.0", `${t("appLicense")}: Apache-2.0`),
        repositoryLink(APP_REPOSITORY_URL)].join("") },
  ];
  return `<div class="provenance-rail">
    <div class="provenance-ledger" role="list" aria-label="${escapeHtml(t("provenance"))}">
      ${facts.map(fact => `<div class="provenance-row provenance-fact" role="listitem" data-provenance-entity="${fact.key}">
        <a class="provenance-entity" href="${escapeHtml(fact.url)}" tabindex="0" target="_blank" rel="noreferrer" aria-label="${escapeHtml(fact.accessibleName)}">${fact.name}</a>
        <span class="provenance-role">${escapeHtml(fact.role)}</span>
        <b class="provenance-version">${escapeHtml(fact.marker)}${fact.key === "hras" ? renderAnnotation("source-sync", t) : fact.key === "app" ? renderAnnotation("snapshot-notes", t) : ""}</b>
        <span class="provenance-date"><span class="visually-hidden">${escapeHtml(fact.dateLabel)}: </span><time${fact.dateTime}>${escapeHtml(fact.date)}</time>${renderAnnotation(fact.key === "hras" ? "hras-date" : fact.key === "yfull" ? "yfull-date" : "index-date", t)}</span>
        <nav class="provenance-links" aria-label="${fact.name}">${fact.links}</nav>
      </div>`).join("")}
<div id="source-sync-details" hidden><dl class="annotation-facts"><div><dt>HRAS/YSEQ</dt><dd>${escapeHtml(hrasMarker.replace(/^v/i, ""))}</dd></div><div><dt>YFull/YTree</dt><dd>${escapeHtml(yfullMarker)}</dd></div></dl><p data-status="${status}">${escapeHtml(t(statusLabel))}</p></div>
<div id="snapshot-notes-details" hidden><dl class="annotation-facts"><div><dt>yNodus</dt><dd>${escapeHtml(displayVersion)}</dd></div></dl></div>
${facts.map(fact => `<div id="${fact.key === "app" ? "index" : fact.key}-date-details" hidden><dl class="annotation-facts"><div><dt>${fact.name}</dt><dd>${escapeHtml(fact.date)}</dd></div></dl></div>`).join("")}
    </div>
  </div>`;
}
