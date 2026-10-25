import type { Locale } from "./types";

export function pluralLabel(
  locale: Locale,
  count: number,
  one: string,
  few: string,
  many: string,
): string {
  if (locale !== "ru") return count === 1 ? one : many;
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
