import { renderPeriodGuideContent } from "./timeline-periods";
import { renderCrossingDiagram } from "./crossing-diagram";
import { escapeHtml, renderTextParagraphs } from "../shared/html";
import type { TextKey } from "./i18n";

type Subject = { title: TextKey; label: TextKey; copy: TextKey[]; details?: TextKey; source?: { url: string; label: TextKey } };
export const ANNOTATIONS = {
  periods: { title: "periodGuideCaveat", label: "periodGuideCaveat", copy: [] },
  "log-scale": { title: "compressedDates", label: "compressedDates", copy: ["logScaleExplanation"] },
  "density-step": { title: "densityStepLabel", label: "densityStepLabel", copy: ["densityStepHint"] },
  "density-anchor": { title: "densityAnchorLabel", label: "densityAnchorLabel", copy: ["densityAnchorHint"] },
  "density-sync": { title: "densitySyncLabel", label: "densitySyncLabel", copy: ["densitySyncHint"] },
  "density-measure": { title: "densityMeasureLabel", label: "densityMeasureLabel", copy: ["densityMeasureHint"] },
  "sample-scope": { title: "sampleScopeLabel", label: "sampleScopeLabel", copy: ["sampleScopeHint"] },
  "ancient-samples": { title: "ancientHeaderShort", label: "ancientHeaderShort", copy: ["sampleRegionsHint", "ancientSamplesHint"], source: { url: "https://hras.yseq.net/documentationPage.html", label: "sourceLinkShort" } },
  "snapshot-notes": { title: "sourceDetailsAction", label: "sourceDetailsAction", copy: ["aggregatedPrivacyShort", "sourceLinkage"] },
  "source-sync": { title: "sourceVersionsTitle", label: "sourceVersionsTitle", copy: ["sourceSyncHint", "ancientSamplesHint", "sampleRegionsHint"], source: { url: "https://hras.yseq.net/documentationPage.html", label: "sourceLinkShort" } },
  "hras-date": { title: "sourceComputedDate", label: "sourceComputedDate", copy: ["hrasDateHint"], source: { url: "https://hras.yseq.net/data/manifest", label: "sourceLinkShort" } },
  "yfull-date": { title: "sourceVersionDate", label: "sourceVersionDate", copy: ["yfullDateHint"], source: { url: "https://github.com/YFullTeam/YTree", label: "sourceLinkShort" } },
  "index-date": { title: "dataUpdated", label: "dataUpdated", copy: ["indexDateHint"], source: { url: "./data/hras-index.json", label: "datasetLinkShort" } },
  countries: { title: "selectedCountries", label: "annotationCountries", copy: ["resultGuideCountries"] },
  "sample-countries": { title: "profileCountryEvidence", label: "annotationCountries", copy: ["branchWarningShort"] },
  "sample-counts": { title: "annotationSampleCounts", label: "annotationSampleCounts", copy: ["samplingBiasCaveat", "nestedCountsCaveat"] },
  "matrix-colours": { title: "matrixColourTitle", label: "matrixColourTitle", copy: ["matrixColourHint"] },
  "branch-counts": { title: "annotationSampleCounts", label: "annotationSampleCounts", copy: ["branchCountriesTotalHint", "samplingBiasCaveat", "nestedCountsCaveat"] },
  "missing-records": { title: "annotationMissingRecords", label: "annotationMissingRecords", copy: ["absenceCaveat"] },
  "country-overview-total": { title: "countryOverviewTotal", label: "annotationSampleCounts", copy: ["countryOverviewTotalHint"] },
  "country-projects": { title: "countryOverviewGroups", label: "countryOverviewGroups", copy: ["countryOverviewGroupsHint"] },
  "country-assignments": { title: "countryTreeAssignments", label: "countryTreeAssignments", copy: ["countryOverviewAssignmentsHint"] },
  "country-tree": { title: "countryTreeTitle", label: "countryTreeTitle", copy: ["countryTreeHint"] },
  "source-age": { title: "sourceFormationEstimate", label: "annotationSourceAge", copy: ["branchSourceAgeHint"],
    source: { url: "https://www.yfull.com/faq/how-does-yfull-determine-formed-age-tmrca-and-ci/", label: "formedDefinitionSource" } },
  calendar: { title: "profileCalendarNote", label: "annotationDate", copy: ["calendarEpochCaveat"],
    source: { url: "https://www.yfull.com/faq/definitions/", label: "ageDefinitionSource" } },
  "research-sources": { title: "annotationSources", label: "annotationSources", copy: ["independentSourcesNote", "localSnapshotCoverageCaveat"] },
  date: { title: "target", label: "annotationDate", copy: ["annotationDateCopy"], details: "calendarEpochCaveat",
    source: { url: "https://www.yfull.com/faq/definitions/", label: "ageDefinitionSource" } },
  window: { title: "maxDelta", label: "annotationWindow", copy: ["tooltipMaxDelta"] },
  minimum: { title: "minResultSamples", label: "annotationMinimum", copy: ["tooltipMinResultSamples", "densityCountryMinimumHint"] },
  "result-detail": { title: "resultDetailTitle", label: "resultDetailTitle", copy: ["resultDetailHint"] },
  "country-minimum": { title: "countryBelowMinimumTitle", label: "countryBelowMinimum", copy: ["countryBelowMinimumHint"] },
  presence: { title: "presence", label: "annotationPresence", copy: ["modeAnyHint", "modeAllHint"] },
  formed: { title: "formedResults", label: "annotationFormed", copy: ["annotationFormedCopy"],
    source: { url: "https://www.yfull.com/faq/how-does-yfull-determine-formed-age-tmrca-and-ci/", label: "formedDefinitionSource" } },
  crossing: { title: "crossingResults", label: "annotationCrossing", copy: ["crossingReadingCopy"] },
  "tree-age-pairs": { title: "treeSameAgePairs", label: "annotationTreeAgePairs", copy: ["treeSameAgePairsHint", "branchSameAgeHint"] },
  density: { title: "densityMap", label: "annotationDensity", copy: ["densityPositionHint", "annotationTimelineCopy"] },
  "density-counts": { title: "densityNumbersMeaning", label: "annotationDensityCounts", copy: ["densityCountsHint", "densityCountryMinimumHint", "densityMinimumHeightHint"] },
  "density-groups": { title: "densityContextLegend", label: "annotationDensityGroups", copy: ["densityGroupsHint", "densityGroupAgeHint", "densityContextScope"], source: { url: "https://www.yfull.com/tree/", label: "sourceLinkShort" } },
  "density-results": { title: "densityResultLegend", label: "annotationDensityResults", copy: ["densityResultsHint"] },
} satisfies Record<string, Subject>;
export type AnnotationId = keyof typeof ANNOTATIONS;

export function renderAnnotation(id: AnnotationId, t: (key: TextKey) => string): string {
  const label = ANNOTATIONS[id].label;
  return `<button class="annotation-trigger" type="button" data-annotation="${id}" aria-label="${escapeHtml(t(label))}" data-i18n-aria-label="${label}" aria-expanded="false" aria-controls="context-annotation"><span aria-hidden="true">!</span></button>`;
}

export function annotationContent(id: AnnotationId, t: (key: TextKey) => string): string {
  if (id === "periods") return renderPeriodGuideContent(t);
  const subject: Subject = ANNOTATIONS[id];
  return `<strong>${escapeHtml(t(subject.title))}</strong><div class="annotation-facts-slot"></div>${id === "crossing" ? renderCrossingDiagram(t) : ""}${subject.copy.map(key => renderTextParagraphs(t(key))).join("")}
    ${subject.details ? `<details><summary>${escapeHtml(t("annotationCalendarDetails"))}</summary>${renderTextParagraphs(t(subject.details))}</details>` : ""}
    ${subject.source ? `<a href="${subject.source.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(t(subject.source.label))}</a>` : ""}`;
}

export function renderAnnotationPanel(): string {
  return '<aside id="context-annotation" class="context-annotation" role="note" hidden></aside>';
}
