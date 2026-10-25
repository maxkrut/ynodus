/** Legacy application epoch. Source-age epoch must be verified before changing conversion. */
export const YBP_BASE_YEAR = 1950;
export const DEFAULT_FULL_RANGE_MAX_YBP = 150000;

export function ybpToCalendarYear(ybp: number): number {
  const astronomicalYear = YBP_BASE_YEAR - ybp;
  return astronomicalYear <= 0 ? astronomicalYear - 1 : astronomicalYear;
}

export function calendarYearToYbp(year: number): number {
  if (year === 0) throw new RangeError("The BCE/CE calendar has no year zero");
  const astronomicalYear = year < 0 ? year + 1 : year;
  return Math.max(0, YBP_BASE_YEAR - astronomicalYear);
}
