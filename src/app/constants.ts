export { DEFAULT_SLIDER_MAX_YBP, FULL_RANGE_SLIDER_MAX, LOG_RANGE_START_BCE, LOG_RANGE_START_YBP } from "../shared/time-axis-constants";
import type { Locale } from "../shared/types";

export const DATA_URL = "./data/hras-index.json";
export const APP_VERSION = "v1.2.0";
export const DEFAULT_LOCALE: Locale = "en";
/**
 * The quiet table leads with the strongest country evidence and moves the tail
 * into an explicit disclosure, so a broad row stays one readable line.
 */
export const RESULT_COUNTRY_CHIP_LIMIT = 32;
export const MOBILE_RESULT_COUNTRY_CHIP_LIMIT = 3;
export const TABLE_INITIAL_ROW_LIMIT = 50;
export const TABLE_ROW_INCREMENT = 50;
export const DEFAULT_MAX_DELTA_YBP = 300;
export const MAX_QUERY_YBP = 999_999;
export const DEFAULT_TARGET_YEAR = 3500;
export const DEFAULT_TARGET_ERA = "BCE" as "BCE" | "CE";
export const DEFAULT_MIN_RESULT_SAMPLES = 5;
export const WORKER_REQUEST_TIMEOUT_MS = 60_000;
export const ANALYSIS_DEBOUNCE_MS = 120;
export const SIGNATURE_OPTIONS_DEBOUNCE_MS = 180;
