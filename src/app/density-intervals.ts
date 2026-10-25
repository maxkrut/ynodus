import { LOG_RANGE_START_YBP } from "./constants";
import { sliderValueToYbp, ybpToSliderValueExact, type TimeSliderScale } from "./time-slider";

export type DensityInterval = { start: number; end: number; older: number; younger: number; logarithmic: boolean; mixed: boolean; focused: boolean };
export const MAX_DENSITY_INTERVALS = 8192;
export function densityStep(value: number): number {
  return Number.isSafeInteger(value) && value > 0 && value <= 1000000 ? value : 0;
}

/** Equal steps on the displayed scale; Target changes only the grid's origin. */
export function densityIntervals(step: number, sliderMax: number, scale: TimeSliderScale, target?: number): DensityInterval[] {
  step = densityStep(step);
  if (!step) return [];
  const boundary = scale.fullRange ? Math.max(0, sliderMax - LOG_RANGE_START_YBP) : 0;
  const focused = target !== undefined;
  const center = focused ? Math.max(0, Math.min(sliderMax, ybpToSliderValueExact(target, scale))) : 0;
  const anchor = focused ? center - step / 2 : boundary;
  const first = Math.floor(-anchor / step) + 1;
  const last = Math.ceil((sliderMax - anchor) / step);
  if (last - first + 1 > MAX_DENSITY_INTERVALS) return [];
  const edges = [0];
  for (let i = first; i < last; i++) {
    const value = anchor + i * step;
    if (value > 1e-8 && value < sliderMax - 1e-8) edges.push(value);
  }
  edges.push(sliderMax);
  return edges.slice(0, -1).map((start, index) => {
    const end = edges[index + 1];
    return { start, end, older: sliderValueToYbp(start, scale), younger: sliderValueToYbp(end, scale),
      logarithmic: scale.fullRange && start < boundary,
      mixed: start < boundary && end > boundary,
      focused: focused && start <= center && (end > center || end === sliderMax) };
  });
}

export function densityIntervalIndex(age: number, intervals: DensityInterval[]): number {
  // Use raw source age, not rounded slider coordinates (which can shift a boundary).
  // A shared boundary belongs to exactly one interval, on its younger/right side.
  let low = 0, high = intervals.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (age > intervals[mid].younger) high = mid;
    else low = mid + 1;
  }
  return Math.min(low, intervals.length - 1);
}
