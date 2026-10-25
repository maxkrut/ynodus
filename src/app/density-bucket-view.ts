import { groupFillColor } from "../shared/group-palette";
import { nodeMacroGroup } from "../shared/haplogroups";
import { escapeHtml } from "../shared/html";
import { pluralLabel } from "../shared/plural";
import { ybpToCalendarYear } from "../shared/time";
import type { DensityRow } from "../shared/types";
import { groupDensityFormedLayers } from "./density-model";
import type { TargetControlContext } from "./target-controls";
import { densityIntervalIndex, type DensityInterval } from "./density-intervals";
import { densityIntervalValue, densityValueLabel } from "./density-measure";

type DensityMacroGroup = { count: number; group: string };
type DensityBucketSummary = {
  macroGroups: DensityMacroGroup[];
  uniqueRows: DensityRow[];
  formedLayerCount: number;
  currentResultCount: number;
};

export function renderDensityBucketGrid(
  rows: DensityRow[],
  currentResultIds: ReadonlySet<string>,
  context: TargetControlContext,
  intervals: DensityInterval[],
): { html: string; formedLayerCount: number } {
  const bucketCount = intervals.length;
  const buckets = intervals.map(() => [] as DensityRow[]);
  for (const row of rows) {
    const bucket = densityIntervalIndex(row.node.formed, intervals);
    buckets[bucket].push(row);
  }

  const summaries = buckets.map(bucket => summarizeDensityBucket(bucket, currentResultIds));
  const measure = context.densityMeasure ?? "count";
  const values = summaries.map((summary, i) => densityIntervalValue(summary.uniqueRows.length, intervals[i], measure));
  const maximum = Math.max(...values, 0) || 1;
  let formedLayerCount = 0;
  const html = summaries.map((summary, index) => {
    formedLayerCount += summary.formedLayerCount;
    const count = summary.uniqueRows.length;
    const height = count > 0 ? (measure === "per1000" ? Math.max(.1, values[index] / maximum * 100)
      : Math.max(8, Math.round(values[index] / maximum * 100))) : 4;
    const edgeClass = index < 4 ? " edge-start" : index >= bucketCount - 4 ? " edge-end" : "";
    const resultClass = summary.currentResultCount > 0 ? " has-current-results" : "";
    const className = `${count > 0 ? "context" : "empty"}${resultClass}${edgeClass}${intervals[index].focused ? " density-focused-interval" : ""}`;
    const tooltip = densityBucketTooltip(
      intervals[index], count, summary, context,
    );
    const accessibleLabel = densityBucketAccessibleLabel(
      intervals[index], count, summary, context,
    );
    if (count === 0) {
      if (bucketCount > 256) return "";
      return `<span class="density-cell ${className}" data-density-index="${index}" aria-hidden="true" style="grid-column:${index + 1};grid-row:1;--density-height:${height}%"><span class="density-plot"><span class="density-bar"></span></span></span>`;
    }
    const targetYbp = densityBucketTargetYbp(
      summary.uniqueRows, intervals[index],
    );
    const targetLabel = formatDensityCalendar(targetYbp, context);
    const action = `${context.t("densityJumpToDate")}: ${targetLabel}`;
    const countLabel = densityValueLabel(values[index], measure, context.formatNumber);
    return `<button class="density-cell ${className}" type="button" aria-label="${escapeHtml(`${accessibleLabel}; ${action}`)}" data-tooltip="${escapeHtml(`${tooltip}\n${action}`)}" data-density-index="${index}" data-density-count="${count}" data-density-value="${values[index]}" data-target-ybp="${targetYbp}" data-target-label="${escapeHtml(targetLabel)}" style="grid-column:${index + 1};grid-row:1;--density-height:${height}%"><span class="density-plot"><strong class="density-count${countLabel.length > 3 ? " wide" : ""}" aria-hidden="true">${escapeHtml(countLabel)}</strong><span class="density-bar">${renderDensityMacroStack(summary.macroGroups)}</span></span>${renderDensityMacroLabels(summary.macroGroups)}</button>`;
  }).join("");
  return { html: `${html}<span class="density-hit-region" aria-hidden="true"></span><span class="density-target-guide" aria-hidden="true"></span>`, formedLayerCount };
}

function summarizeDensityBucket(
  rows: DensityRow[],
  currentResultIds: ReadonlySet<string>,
): DensityBucketSummary {
  const uniqueRows = [...new Map(rows.map((row) => [row.node.id, row])).values()];
  const layers = groupDensityFormedLayers(uniqueRows, currentResultIds);
  return {
    macroGroups: densityBucketMacroGroups(uniqueRows),
    uniqueRows,
    formedLayerCount: layers.length,
    currentResultCount: layers.reduce((sum, layer) => sum + layer.currentResultCount, 0),
  };
}

function renderDensityMacroStack(groups: DensityMacroGroup[]): string {
  return `<span class="density-macro-stack" aria-hidden="true">${groups.map((group) =>
    `<i style="flex:${group.count};--density-group-color:${groupFillColor(group.group)}"></i>`,
  ).join("")}</span>`;
}

function renderDensityMacroLabels(groups: DensityMacroGroup[]): string {
  return `<span class="density-macro-labels" aria-hidden="true">${groups.map(group =>
    `<span class="density-macro-letter${group.group.length > 3 ? " density-long-letter" : group.group.length === 3 ? " density-medium-letter" : ""}" style="--density-group-color:${groupFillColor(group.group)}">${escapeHtml(group.group)}</span>`,
  ).join("")}</span>`;
}

function densityBucketTooltip(
  interval: DensityInterval,
  count: number,
  summary: DensityBucketSummary,
  context: TargetControlContext,
): string {
  const parts = [
    ...densityBucketParameters(interval, context),
    `${context.t("densityBucketTotal")}: ${context.formatNumber(count)}`,
    ...densityRateLine(interval, count, context),
    `${context.t("densityFormedLayers")}: ${context.formatNumber(summary.formedLayerCount)}`,
    densityBucketMacroLine(summary.macroGroups, context),
    densityCountryLine(summary.uniqueRows, context),
    densityBucketMatchLine(summary.uniqueRows, context),
  ];
  if (summary.currentResultCount > 0) {
    parts.splice(5, 0, `${context.t("densityCurrentResults")}: ${context.formatNumber(summary.currentResultCount)}`);
  }
  return parts.filter(Boolean).join("\n");
}

function densityBucketAccessibleLabel(
  interval: DensityInterval,
  count: number,
  summary: DensityBucketSummary,
  context: TargetControlContext,
): string {
  const parts = [
    ...densityBucketParameters(interval, context),
    `${context.t("densityBucketTotal")}: ${context.formatNumber(count)}`,
    ...densityRateLine(interval, count, context),
    `${context.t("densityFormedLayers")}: ${context.formatNumber(summary.formedLayerCount)}`,
    densityBucketMacroLine(summary.macroGroups, context),
    densityCountryLine(summary.uniqueRows, context),
  ];
  if (summary.currentResultCount > 0) {
    parts.push(`${context.t("densityCurrentResults")}: ${context.formatNumber(summary.currentResultCount)}`);
  }
  return parts.filter(Boolean).join("; ");
}

function densityCountryLine(rows: DensityRow[], context: TargetControlContext): string {
  const countries = rows[0]?.participatingCountries;
  return countries ? `${context.t("densityRequiredCountries")}: ${countries.join(", ")}` : "";
}

function densityBucketMacroGroups(rows: DensityRow[]): DensityMacroGroup[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const group = nodeMacroGroup(row.node);
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([group, count]) => ({ count, group }))
    .sort((a, b) => b.count - a.count || a.group.localeCompare(b.group));
}

function densityRateLine(interval: DensityInterval, count: number, context: TargetControlContext): string[] {
  if (context.densityMeasure !== "per1000") return [];
  const duration = interval.older - interval.younger;
  const rate = densityIntervalValue(count, interval, "per1000");
  return [`${context.t("densityRateValue")}: ${context.formatNumber(count)} ÷ ${context.formatNumber(duration)} × 1 000 = ${context.formatNumber(rate)}`];
}

function densityBucketMacroLine(groups: DensityMacroGroup[], context: TargetControlContext): string {
  if (groups.length === 0) return "";
  const labels = groups.map(group => `${group.group} ${context.formatNumber(group.count)}`);
  return `${context.t("densityBucketMacroGroups")}: ${labels.join(", ")}`;
}

function densityBucketMatchLine(rows: DensityRow[], context: TargetControlContext): string {
  const sorted = [...rows].sort((a, b) => b.total - a.total || a.node.id.localeCompare(b.node.id));
  const shown = sorted.slice(0, 6).map((row) =>
    `${row.node.id} · ${formatDensityCalendar(row.node.formed, context)} · ${context.formatNumber(row.total)} ${pluralLabel(
      context.locale, row.total, context.t("sample"), context.t("samplesFew"), context.t("samples"),
    )}`,
  );
  const hidden = Math.max(0, sorted.length - shown.length);
  return `${context.t("densityBucketMatches")}: ${shown.join("; ")}${hidden > 0 ? `; +${hidden}` : ""}`;
}

function densityBucketTargetYbp(
  rows: DensityRow[],
  interval: DensityInterval,
): number {
  const center = (interval.older + interval.younger) / 2;
  return [...rows].sort((a, b) =>
    b.total - a.total
    || Math.abs(a.node.formed - center) - Math.abs(b.node.formed - center)
    || b.node.formed - a.node.formed
    || a.node.id.localeCompare(b.node.id),
  )[0]?.node.formed ?? Math.round(center);
}

function densityBucketParameters(
  interval: DensityInterval,
  context: TargetControlContext,
): string[] {
  return [
    `${context.t("densityBucketRange")}: ${formatDensityCalendar(interval.older, context)} – ${formatDensityCalendar(interval.younger, context)}`,
    `${context.t("densityDuration")}: ${context.t("densityYears").replace("{n}", context.formatNumber(interval.older - interval.younger))}`,
    `${context.t("densityScale")}: ${context.t(interval.mixed ? "densityMixed" : interval.logarithmic ? "densityLogarithmic" : "densityLinear")}`,
  ];
}

function formatDensityCalendar(ybp: number, context: TargetControlContext): string {
  const calendarYear = ybpToCalendarYear(Math.round(ybp));
  const era = calendarYear < 0 ? "eraBceShort" : "eraCeShort";
  return `${context.formatNumber(Math.abs(calendarYear))} ${context.t(era)}`;
}
