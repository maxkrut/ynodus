import { calendarYearToYbp, ybpToCalendarYear } from "../shared/time";
import { DEFAULT_TARGET_YEAR, MAX_QUERY_YBP } from "./constants";

/** One bounded calendar value for the editor, axis, worker and export. */
export function readTargetDate(input: HTMLInputElement, eraControl: HTMLButtonElement) {
  const raw = input.value.trim();
  const fallback = Number(input.dataset.targetYbp ?? calendarYearToYbp(-Number(DEFAULT_TARGET_YEAR)));
  const era = eraControl.value === "CE" ? "CE" : "BCE";
  const year = Math.max(1, Math.round(Number(raw)));
  const ybp = raw === "" || !Number.isFinite(year)
    ? fallback
    : Math.min(MAX_QUERY_YBP, calendarYearToYbp(era === "BCE" ? -year : year));
  const calendar = ybpToCalendarYear(ybp);
  return { ybp, year: Math.abs(calendar), era: calendar < 0 ? "BCE" : "CE" } as const;
}

export function rememberTargetDate(input: HTMLInputElement, ybp: number): void {
  input.dataset.targetYbp = String(ybp);
}

export function rememberTargetEraDraft(
  input: HTMLInputElement,
  era: "BCE" | "CE",
  year: number,
): void {
  input.dataset[era === "BCE" ? "bceYearDraft" : "ceYearDraft"] = String(year);
}

export function targetEraDraft(
  input: HTMLInputElement,
  era: "BCE" | "CE",
): number | null {
  const raw = input.dataset[era === "BCE" ? "bceYearDraft" : "ceYearDraft"];
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;
}
