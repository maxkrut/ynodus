import { calendarYearToYbp } from "./time";
export const DEFAULT_SLIDER_MAX_YBP = 12000;
export const FULL_RANGE_SLIDER_MAX = 20000;
export const LOG_RANGE_START_BCE = 10_000;
export const LOG_RANGE_START_YBP = calendarYearToYbp(-LOG_RANGE_START_BCE);
