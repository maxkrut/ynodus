import type { DensityInterval } from "./density-intervals";

export type DensityMeasure = "count" | "per1000";

export function densityIntervalValue(count: number, interval: DensityInterval, measure: DensityMeasure): number {
  const duration = interval.older - interval.younger;
  return measure === "per1000" ? (duration > 0 ? count * 1000 / duration : 0) : count;
}

/** Compact bar labels; never round a positive density to a displayed zero. */
export function densityValueLabel(value: number, measure: DensityMeasure, format: (n: number) => string): string {
  if (measure === "count") return format(value);
  if (value > 0 && value < .1) return `<${format(.1)}`;
  return format(Math.round(value * 10) / 10);
}
