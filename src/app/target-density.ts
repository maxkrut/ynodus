import { escapeHtml } from "../shared/html";
import { DEFAULT_SLIDER_MAX_YBP } from "./constants";
import { renderDensityBucketGrid } from "./density-bucket-view";
import { densityIntervals, densityIntervalIndex, type DensityInterval } from "./density-intervals";
import { parseInteger } from "./format";
import { densityParentGroups } from "./density-parent-groups";
import type { TargetControlContext, TargetControlElements } from "./target-controls";
import {
  sliderValueToYbp,
  ybpToSliderValue,
  type TimeSliderScale,
} from "./time-slider";

const densityScopeIds = new WeakMap<object, number>();
const pendingDensityFocus = new WeakMap<HTMLElement, number>();
let nextDensityScopeId = 1;


export function renderAxisDensity(
  elements: TargetControlElements,
  context: TargetControlContext,
  ybp: number,
): void {
  const axis = elements.targetSlider.closest<HTMLElement>(".time-axis");
  const timelineZone = axis?.closest<HTMLElement>(".timeline-zone");
  const rows = context.densityRows;
  const pending = context.densityStatus === "pending";
  const normalized = context.densityMeasure === "per1000";
  elements.targetDensity.dataset.densityCountUnit = context.densityUnit ?? "subclades";
  const legend = timelineZone?.querySelector<HTMLElement>(".density-legend-context .legend-full");
  const compactLegend = timelineZone?.querySelector<HTMLElement>(".density-legend-context .legend-compact");
  if (legend) { const key = context.densityUnit === "parents" ? "densityParentLegend" : "densityContextLegend"; legend.dataset.i18n = key; legend.textContent = context.t(key); }
  if (compactLegend) { const key = context.densityUnit === "parents" ? "densityParentCompact" : "densityGroupsCompact"; compactLegend.dataset.i18n = key; compactLegend.textContent = context.t(key); }
  elements.targetDensity.classList.toggle("density-per1000", normalized);
  const caption = timelineZone?.querySelector<HTMLElement>(".density-height-caption");
  if (caption) {
    const key = context.densityUnit === "parents" ? (normalized ? "densityParentRate" : "densityParentHeight")
      : normalized ? "densityHeightRate" : "densityHeightShort";
    caption.dataset.i18n = key;
    caption.textContent = context.t(key);
  }
  const activeBeforeUpdate = document.activeElement instanceof HTMLElement
    && elements.targetDensity.contains(document.activeElement)
    ? document.activeElement.closest<HTMLElement>("button[data-target-ybp]") : null;
  if (pending && activeBeforeUpdate) {
    pendingDensityFocus.set(elements.targetDensity, Number(activeBeforeUpdate.dataset.targetYbp));
  }
  elements.targetDensity.inert = pending;
  elements.targetDensity.setAttribute("aria-busy", String(pending));

  updateHitWindow(elements, context, ybp);
  axis?.classList.toggle("formed-density", context.sliceMode === "formed");
  timelineZone?.classList.toggle(
    "formed-density-map",
    context.sliceMode === "formed" && context.resultRows.length > 0,
  );

  const sliderMax = parseInteger(elements.targetSlider.max, DEFAULT_SLIDER_MAX_YBP);
  const scale = sliderScale(context);
  const intervals = context.densityGrid ?? densityIntervals(context.densityStep ?? 300, sliderMax, scale,
    context.densityAnchor === "target" ? ybp : undefined);
  const message = timelineZone?.querySelector<HTMLElement>("#density-settings-status");
  if (message) {
    message.hidden = intervals.length > 0;
    message.textContent = context.t(context.densitySync && context.maxDeltaYbp === 0 ? "densityZeroWindow" : "densityStepInvalid");
  }
  if (!intervals.length) {
    pendingDensityFocus.delete(elements.targetDensity);
    elements.targetDensity.innerHTML = "";
    delete elements.targetDensity.dataset.densityResultRanges;
    delete elements.targetDensity.dataset.densityGridKey;
    elements.targetDensitySummary.textContent = "";
    return;
  }

  if (rows.length === 0) {
    pendingDensityFocus.delete(elements.targetDensity);
    axis?.classList.remove("has-density", "has-hit-window");
    elements.targetDensity.innerHTML = "";
    delete elements.targetDensity.dataset.densityResultRanges;
    delete elements.targetDensity.dataset.densityGridKey;
    elements.targetDensitySummary.textContent = context.t(context.densityStatus === "ready"
      ? "densityNoDatedSubclades" : context.densityStatus === "error" ? "densityUnavailable"
        : context.densityStatus === "no-selection" ? "emptySelectCountry" : "densityAwaitingResults");
    return;
  }

  const visibleMaxYbp = Math.max(
    sliderValueToYbp(0, scale),
    sliderValueToYbp(sliderMax, scale),
  );
  const visibleRows = rows.filter((row) => row.node.formed <= visibleMaxYbp);
  const visibleIds = new Set(visibleRows.map(row => row.node.id));
  const currentResultNodes = !pending && context.sliceMode === "formed"
    ? new Map(context.resultRows.flatMap((row) =>
        row.formedEvents?.flatMap((event) =>
          event.formedMembers.map((member) => [member.node.id, member.node.formed] as const))
        ?? row.formedMembers?.map((member) => [member.node.id, member.node.formed] as const)
        ?? [[row.node.id, row.node.formed] as const]).filter(([id]) => visibleIds.has(id)))
    : new Map<string, number>();
  const currentResultIds = new Set(currentResultNodes.keys());
  elements.targetDensity.style.gridTemplateColumns = intervals.map(item => `minmax(0, ${item.end - item.start}fr)`).join(" ");
  axis?.classList.toggle("has-density", visibleRows.length > 0);
  axis?.classList.toggle(
    "has-hit-window",
    context.sliceMode === "formed" && visibleRows.length > 0 && context.maxDeltaYbp > 0,
  );
  const gridKey = densityGridKey(rows, visibleMaxYbp, sliderMax, scale,
    `${intervals.map(bin => `${bin.start}:${bin.end}`).join(",")}|${context.densityMeasure ?? "count"}|${context.densityUnit ?? "subclades"}`, context.locale);
  if (elements.targetDensity.dataset.densityGridKey !== gridKey) {
    const active = document.activeElement instanceof HTMLElement && elements.targetDensity.contains(document.activeElement)
      ? document.activeElement.closest<HTMLElement>("button[data-target-ybp]") : null;
    const focusedAge = active ? Number(active.dataset.targetYbp) : null;
    const bucketGrid = renderDensityBucketGrid(
      visibleRows,
      currentResultIds,
      context,
      intervals,
    );
    elements.targetDensity.innerHTML = bucketGrid.html;
    delete elements.targetDensity.dataset.densityResultRanges;
    elements.targetDensity.dataset.densityGridKey = gridKey;
    if (focusedAge !== null) elements.targetDensity.querySelector<HTMLButtonElement>(
      `button[data-density-index="${densityIntervalIndex(focusedAge, intervals)}"]`,
    )?.focus({ preventScroll: true });
  } else {
    updateDensityResultHighlights(
      elements.targetDensity,
      currentResultNodes,
      intervals,
      context,
    );
  }
  renderDensityResultRanges(elements.targetDensity);
  const pendingFocusAge = pendingDensityFocus.get(elements.targetDensity);
  if (!pending && pendingFocusAge !== undefined) {
    pendingDensityFocus.delete(elements.targetDensity);
    // Inert temporarily removes focus; a deliberate move elsewhere must win.
    if ((document.activeElement === document.body || elements.targetDensity.contains(document.activeElement))
      && !elements.targetDensity.closest("[inert]") && elements.targetDensity.getClientRects().length) {
      elements.targetDensity.querySelector<HTMLElement>(
        `button[data-density-index="${densityIntervalIndex(pendingFocusAge, intervals)}"]`,
      )?.focus({ preventScroll: true });
    }
  }

  const summaryItems = pending
    ? [`<span class="density-pending-note">${escapeHtml(context.t("densityUpdatingPrevious"))}</span>`]
    : [`<span>${escapeHtml(context.t("densityScopeTotal"))}: <strong>${escapeHtml(context.formatNumber(visibleRows.length))}</strong> · ${escapeHtml(context.t("densityParentScope"))}: <strong>${context.formatNumber(densityParentGroups(visibleRows).length)}</strong></span>`];
  const summaryHtml = `<div class="density-reading-line">${summaryItems.join("")}</div>`;
  if (elements.targetDensitySummary.innerHTML !== summaryHtml) elements.targetDensitySummary.innerHTML = summaryHtml;
}

/** One contour per uninterrupted run of matching intervals, including uneven log cells. */
function renderDensityResultRanges(root: HTMLElement): void {
  const signature = [...root.querySelectorAll<HTMLElement>(".density-cell.has-current-results")]
    .map(cell => cell.dataset.densityIndex).join();
  if (root.dataset.densityResultRanges === signature) return;
  root.dataset.densityResultRanges = signature;
  root.querySelectorAll(".density-result-range").forEach(range => range.remove());
  const fragment = document.createDocumentFragment();
  let range: HTMLSpanElement | null = null;
  let start = -1;
  let end = -2;
  for (const cell of root.querySelectorAll<HTMLElement>(".density-cell.has-current-results")) {
    const index = Number(cell.dataset.densityIndex);
    if (index !== end + 1) {
      range = document.createElement("span");
      range.className = "density-result-range";
      range.setAttribute("aria-hidden", "true");
      fragment.append(range);
      start = index;
    }
    end = index;
    range!.style.gridColumn = `${start + 1} / ${end + 2}`;
  }
  root.append(fragment);
}

function densityGridKey(
  rows: object,
  visibleMaxYbp: number,
  sliderMax: number,
  scale: TimeSliderScale,
  gridSignature: string,
  locale: string,
): string {
  let scopeId = densityScopeIds.get(rows);
  if (!scopeId) {
    scopeId = nextDensityScopeId;
    nextDensityScopeId += 1;
    densityScopeIds.set(rows, scopeId);
  }
  return `${scopeId}|${visibleMaxYbp}|${sliderMax}|${scale.fullRange}|${scale.maxFormedYbp}|${gridSignature}|${locale}`;
}

function updateDensityResultHighlights(
  root: HTMLElement,
  currentResultNodes: ReadonlyMap<string, number>,
  intervals: DensityInterval[],
  context: TargetControlContext,
): void {
  const counts = new Map<number, number>();
  for (const formed of currentResultNodes.values()) {
    const index = densityIntervalIndex(formed, intervals);
    counts.set(index, (counts.get(index) ?? 0) + 1);
  }
  const prefix = `${context.t("densityCurrentResults")}:`;
  for (const cell of root.querySelectorAll<HTMLElement>("[data-density-index]")) {
    const index = Number(cell.dataset.densityIndex);
    const count = counts.get(index) ?? 0;
    cell.classList.toggle("has-current-results", count > 0);
    if (!(cell instanceof HTMLButtonElement)) continue;
    const baseTitle = (cell.dataset.tooltip ?? "")
      .split("\n").filter((line) => !line.startsWith(prefix)).join("\n");
    const titleLines = baseTitle.split("\n");
    if (count > 0) titleLines.splice(5, 0, `${prefix} ${context.formatNumber(count)}`);
    const nextTitle = titleLines.join("\n");
    cell.dataset.tooltip = nextTitle;
    const baseLabel = (cell.getAttribute("aria-label") ?? "")
      .split("; ").filter((part) => !part.startsWith(prefix)).join("; ");
    cell.setAttribute(
      "aria-label",
      count > 0 ? `${baseLabel}; ${prefix} ${context.formatNumber(count)}` : baseLabel,
    );
  }
}

export function updateHitWindow(
  elements: TargetControlElements,
  context: TargetControlContext,
  ybp: number,
): void {
  const sliderMax = parseInteger(elements.targetSlider.max, DEFAULT_SLIDER_MAX_YBP);
  const scale = sliderScale(context);
  const olderPercent = sliderPercentForYbp(ybp + context.maxDeltaYbp, sliderMax, scale);
  const youngerPercent = sliderPercentForYbp(Math.max(0, ybp - context.maxDeltaYbp), sliderMax, scale);
  const hitStart = Math.min(olderPercent, youngerPercent);
  const hitEnd = Math.max(olderPercent, youngerPercent);
  const axis = elements.targetSlider.closest<HTMLElement>(".time-axis");
  axis?.style.setProperty("--hit-start", `${hitStart}%`);
  axis?.style.setProperty("--hit-end", `${hitEnd}%`);
}

export function sliderPercentForYbp(
  ybp: number,
  sliderMax: number,
  scale: TimeSliderScale,
): number {
  return Math.max(0, Math.min(100, (ybpToSliderValue(ybp, scale) / Math.max(sliderMax, 1)) * 100));
}

function sliderScale(context: TargetControlContext): TimeSliderScale {
  return {
    fullRange: true,
    maxFormedYbp: context.maxFormedYbp,
  };
}
