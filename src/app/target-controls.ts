import { calendarYearToYbp, YBP_BASE_YEAR, ybpToCalendarYear } from "../shared/time";
import type {
  DensityRow,
  Locale,
  ResultRow,
  SliceMode,
} from "../shared/types";
import { DEFAULT_SLIDER_MAX_YBP, LOG_RANGE_START_BCE, MAX_QUERY_YBP } from "./constants";
import { readTargetDate, rememberTargetDate, rememberTargetEraDraft } from "./target-date";
import { parseInteger } from "./format";
import { setText } from "./dom";
import { renderAxisDensity, sliderPercentForYbp, updateHitWindow } from "./target-density";
import {
  axisMarkerPositions,
  fullRangeMaxYbp,
  sliderRangeMax,
  sliderValueToYbp,
  ybpToSliderValue,
  type TimeSliderScale,
} from "./time-slider";
import type { TextKey } from "./i18n";
import type { DensityMeasure } from "./density-measure";
import { TIME_PERIOD_BANDS, periodRange } from "./timeline-periods";
import { layoutPeriodLabels } from "./period-labels";

export type TargetControlElements = {
  targetYear: HTMLInputElement;
  targetEra: HTMLButtonElement;
  targetSlider: HTMLInputElement;
  targetDensity: HTMLDivElement;
  targetDensitySummary: HTMLDivElement;
};

export type TargetControlContext = {
  densityGrid?: import("./density-intervals").DensityInterval[];
  densityMeasure?: DensityMeasure;
  densityStep?: number;
  densityAnchor?: "axis" | "target";
  densitySync?: boolean;
  locale: Locale;
  densityRows: DensityRow[];
  resultRows: ResultRow[];
  maxDeltaYbp: number;
  maxFormedYbp: number;
  sliceMode: SliceMode;
  densityStatus?: "pending" | "ready" | "error" | "no-selection";
  t: (key: TextKey) => string;
  formatNumber: (value: number) => string;
};

// Keep the semantic period boxes adjacent. Extending every box across its
// neighbor made their labels collide at phone widths.
const PERIOD_TRANSITION_OVERLAP_PERCENT = 0;

export function targetYbpFromControls(elements: TargetControlElements): number {
  return readTargetDate(elements.targetYear, elements.targetEra).ybp;
}

export function ybpFromTargetSlider(
  elements: TargetControlElements,
  context: TargetControlContext,
): number {
  return sliderValueToYbp(
    parseInteger(elements.targetSlider.value, 0),
    sliderScale(context),
  );
}

export function renderTargetControls(
  elements: TargetControlElements,
  context: TargetControlContext,
  renderDensity = true,
): void {
  const { era, year, ybp } = readTargetDate(elements.targetYear, elements.targetEra);
  renderTargetEraSwitch(elements.targetEra, era, context);
  if (elements.targetYear.value.trim() !== "") {
    elements.targetYear.value = String(year);
    rememberTargetEraDraft(elements.targetYear, era, year);
  }
  elements.targetYear.max = String(era === "CE" ? YBP_BASE_YEAR : MAX_QUERY_YBP - YBP_BASE_YEAR + 1);
  rememberTargetDate(elements.targetYear, ybp);
  syncSliderRange(elements, context, ybp);
  elements.targetSlider.value = String(
    ybpToSliderValue(ybp, sliderScale(context)),
  );
  updateSliderAccessibleValue(elements.targetSlider, year, era, ybp, context);
  updateAxisMarkers(elements, context, ybp);
  if (renderDensity) renderAxisDensity(elements, context, ybp);
  else updateHitWindow(elements, context, ybp);
  renderTargetText(year, era, ybp, context);
}

export function setTargetControlsFromYbp(
  elements: TargetControlElements,
  context: TargetControlContext,
  ybp: number,
  syncSlider = true,
  renderDensity = true,
): void {
  const value = Math.min(MAX_QUERY_YBP, Math.max(0, Math.round(ybp)));
  rememberTargetDate(elements.targetYear, value);
  const calendarYear = ybpToCalendarYear(value);
  if (calendarYear < 0) {
    elements.targetEra.value = "BCE";
    elements.targetYear.value = String(Math.abs(calendarYear));
  } else {
    elements.targetEra.value = "CE";
    elements.targetYear.value = String(calendarYear);
  }
  rememberTargetEraDraft(
    elements.targetYear,
    elements.targetEra.value === "CE" ? "CE" : "BCE",
    Math.abs(calendarYear),
  );
  if (syncSlider) syncSliderRange(elements, context, value);
  if (syncSlider) {
    elements.targetSlider.value = String(
      ybpToSliderValue(value, sliderScale(context)),
    );
  }
  updateSliderAccessibleValue(
    elements.targetSlider,
    parseInteger(elements.targetYear.value, 0),
    elements.targetEra.value,
    value,
    context,
  );
  updateAxisMarkers(elements, context, value);
  if (renderDensity) renderAxisDensity(elements, context, value);
  else updateHitWindow(elements, context, value);
  const era = targetEraValue(elements.targetEra);
  elements.targetYear.max = String(era === "CE" ? YBP_BASE_YEAR : MAX_QUERY_YBP - YBP_BASE_YEAR + 1);
  renderTargetEraSwitch(elements.targetEra, era, context);
  renderTargetText(parseInteger(elements.targetYear.value, 0), era, value, context);
}

function targetEraValue(control: HTMLButtonElement): "BCE" | "CE" {
  return control.value === "CE" ? "CE" : "BCE";
}

function renderTargetEraSwitch(
  control: HTMLButtonElement,
  era: "BCE" | "CE",
  context: TargetControlContext,
): void {
  control.value = era;
  control.setAttribute("aria-checked", String(era === "CE"));
  control.classList.toggle("is-on", era === "CE");
  setText("target-era-current", context.t(era === "BCE" ? "eraBceShort" : "eraCeShort"));
}

function renderTargetText(
  year: number,
  era: string,
  ybp: number,
  context: TargetControlContext,
): void {
  setText("target-ybp", `${context.t("targetYbp")}: ${context.formatNumber(ybp)} ${context.t("ybp")}`);
  setText("stat-target", `${context.formatNumber(year)} ${localizedEra(era, context)}`);
}

function updateSliderAccessibleValue(
  slider: HTMLInputElement,
  year: number,
  era: string,
  ybp: number,
  context: TargetControlContext,
): void {
  slider.setAttribute(
    "aria-valuetext",
    `${context.formatNumber(year)} ${localizedEra(era, context)} · ${context.formatNumber(ybp)} ${context.t("ybp")}`,
  );
}

function syncSliderRange(
  elements: TargetControlElements,
  context: TargetControlContext,
  ybp: number,
): void {
  elements.targetSlider.max = String(sliderRangeMax(true));
  updateAxisMode(elements, context, ybp);
}

function updateAxisMarkers(
  elements: TargetControlElements,
  context: TargetControlContext,
  ybp: number,
): void {
  const sliderMax = parseInteger(elements.targetSlider.max, DEFAULT_SLIDER_MAX_YBP);
  const markers = axisMarkerPositions(ybp, sliderMax, sliderScale(context));
  elements.targetSlider.style.setProperty("--zero-pos", `${markers.zero}%`);
  elements.targetSlider.style.setProperty("--target-pos", `${markers.target}%`);
  elements.targetSlider.style.setProperty("--bce-mid-pos", `${markers.bceMid}%`);
  const axis = elements.targetSlider.closest<HTMLElement>(".time-axis");
  axis?.style.setProperty("--zero-pos", `${markers.zero}%`);
  axis?.style.setProperty("--target-pos", `${markers.target}%`);
  axis?.style.setProperty("--bce-mid-pos", `${markers.bceMid}%`);
  axis?.classList.toggle("target-left-edge", markers.target < 8);
  axis?.classList.toggle("target-right-edge", markers.target > 92);
  renderPeriodBands(axis, sliderMax, sliderScale(context), context);
}

function renderPeriodBands(
  axis: HTMLElement | null,
  sliderMax: number,
  scale: TimeSliderScale,
  context: TargetControlContext,
): void {
  if (!axis) return;

  const scaleStart = sliderValueToYbp(0, scale);
  for (const period of TIME_PERIOD_BANDS) {
    const band = axis.querySelector<HTMLElement>(`[data-period-band="${period.key}"]`);
    if (!band) continue;

    const range = periodRange(period, context.t, context.formatNumber);
    band.title = `${context.t(period.label)}: ≈ ${range}`;
    const rangeLabel = axis.closest(".timeline-zone")?.querySelector(`[data-period-range="${period.key}"]`);
    if (rangeLabel) rangeLabel.textContent = range;
    const startYbp = period.startYear === null ? scaleStart : calendarYearToYbp(period.startYear);
    const endYbp = calendarYearToYbp(period.endYear);
    const visibleStartYbp = Math.min(Math.max(startYbp, 0), scaleStart);
    const visibleEndYbp = Math.min(Math.max(endYbp, 0), scaleStart);

    if (visibleStartYbp <= 0 || visibleEndYbp >= scaleStart || visibleStartYbp <= visibleEndYbp) {
      band.hidden = true;
      continue;
    }

    const olderPercent = sliderPercentForYbp(visibleStartYbp, sliderMax, scale);
    const youngerPercent = sliderPercentForYbp(visibleEndYbp, sliderMax, scale);
    const left = Math.min(olderPercent, youngerPercent);
    const right = Math.max(olderPercent, youngerPercent);
    const overlappedLeft = Math.max(0, left - PERIOD_TRANSITION_OVERLAP_PERCENT);
    const overlappedRight = Math.min(100, right + PERIOD_TRANSITION_OVERLAP_PERCENT);
    band.hidden = false;
    band.style.left = `${overlappedLeft}%`;
    band.style.width = `${Math.max(0.6, overlappedRight - overlappedLeft)}%`;
  }
  layoutPeriodLabels(axis);
}

function updateAxisMode(
  elements: TargetControlElements,
  context: TargetControlContext,
  ybp = targetYbpFromControls(elements),
): void {
  const axis = elements.targetSlider.closest<HTMLElement>(".time-axis");
  axis?.classList.add("full-range");
  const logBoundaryLabel = `${context.formatNumber(LOG_RANGE_START_BCE)} ${context.t("eraBceShort")}`;
  const oldestLabel = formatAxisCalendarYbp(
    fullRangeMaxYbp(context.maxFormedYbp, ybp),
    context,
  );
  setText(
    "axis-bce-mid",
    logBoundaryLabel,
  );
  setText(
    "axis-bce-end",
    oldestLabel,
  );
  setText(
    "axis-log-start",
    oldestLabel,
  );
  setText(
    "axis-log-end",
    logBoundaryLabel,
  );
}

function formatAxisCalendarYbp(ybp: number, context: TargetControlContext): string {
  const calendarYear = ybpToCalendarYear(ybp);
  const era = calendarYear < 0 ? "eraBceShort" : "eraCeShort";
  return `${context.formatNumber(Math.abs(calendarYear))} ${context.t(era)}`;
}

function localizedEra(era: string, context: TargetControlContext): string {
  return context.t(era === "BCE" ? "eraBceShort" : "eraCeShort");
}

function sliderScale(context: TargetControlContext): TimeSliderScale {
  return {
    fullRange: true,
    maxFormedYbp: context.maxFormedYbp,
  };
}
