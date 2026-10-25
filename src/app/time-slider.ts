import { DEFAULT_FULL_RANGE_MAX_YBP, YBP_BASE_YEAR, calendarYearToYbp } from "../shared/time";
import {
  DEFAULT_SLIDER_MAX_YBP,
  FULL_RANGE_SLIDER_MAX,
  LOG_RANGE_START_BCE,
  LOG_RANGE_START_YBP,
} from "./constants";

export type TimeSliderScale = {
  fullRange: boolean;
  maxFormedYbp?: number;
};

type AxisMarkerPositions = {
  zero: number;
  target: number;
  bceMid: number;
};

export function ybpToSliderValue(ybp: number, scale: TimeSliderScale): number {
  return sliderRangeMax(scale.fullRange) - ybpToSliderMagnitude(ybp, scale);
}

/** Unrounded projection for interval edges; the interactive slider retains its rounded values. */
export function ybpToSliderValueExact(ybp: number, scale: TimeSliderScale): number {
  return sliderRangeMax(scale.fullRange) - ybpToSliderMagnitude(ybp, scale, false);
}

export function sliderValueToYbp(sliderValue: number, scale: TimeSliderScale): number {
  return sliderMagnitudeToYbp(sliderRangeMax(scale.fullRange) - sliderValue, scale);
}

export function sliderRangeMax(fullRange: boolean): number {
  return fullRange ? FULL_RANGE_SLIDER_MAX : DEFAULT_SLIDER_MAX_YBP;
}

export function fullRangeMaxYbp(maxFormedYbp = 0, extraYbp = 0): number {
  return Math.max(
    DEFAULT_FULL_RANGE_MAX_YBP,
    maxFormedYbp,
    Math.max(0, extraYbp),
  );
}

export function axisMarkerPositions(
  ybp: number,
  sliderMax: number,
  scale: TimeSliderScale,
): AxisMarkerPositions {
  const bceMidYbp = calendarYearToYbp(scale.fullRange ? -LOG_RANGE_START_BCE : -5000);
  return {
    zero: sliderPercent(YBP_BASE_YEAR, sliderMax, scale),
    target: sliderPercent(ybp, sliderMax, scale),
    bceMid: sliderPercent(bceMidYbp, sliderMax, scale),
  };
}

function sliderPercent(ybp: number, sliderMax: number, scale: TimeSliderScale): number {
  return clampPercent((ybpToSliderValue(ybp, scale) / Math.max(sliderMax, 1)) * 100);
}

function ybpToSliderMagnitude(ybp: number, scale: TimeSliderScale, rounded = true): number {
  if (!scale.fullRange || ybp <= LOG_RANGE_START_YBP) return Math.max(0, ybp);
  const maxYbp = fullRangeMaxYbp(scale.maxFormedYbp, ybp);
  const capped = Math.min(maxYbp, ybp);
  const progress =
    Math.log(capped / LOG_RANGE_START_YBP) /
    Math.log(maxYbp / LOG_RANGE_START_YBP);
  const value = LOG_RANGE_START_YBP + progress * (FULL_RANGE_SLIDER_MAX - LOG_RANGE_START_YBP);
  return rounded ? Math.round(value) : value;
}

function sliderMagnitudeToYbp(sliderMagnitude: number, scale: TimeSliderScale): number {
  const value = Math.max(0, sliderMagnitude);
  if (!scale.fullRange || value <= LOG_RANGE_START_YBP) return value;
  const maxYbp = fullRangeMaxYbp(scale.maxFormedYbp);
  const progress =
    (value - LOG_RANGE_START_YBP) / (FULL_RANGE_SLIDER_MAX - LOG_RANGE_START_YBP);
  return Math.round(
    LOG_RANGE_START_YBP *
      Math.exp(progress * Math.log(maxYbp / LOG_RANGE_START_YBP)),
  );
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}
