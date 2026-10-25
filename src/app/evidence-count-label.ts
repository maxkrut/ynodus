import { pluralLabel } from "../shared/plural";
import type { TextKey } from "./i18n";

/** Keep countries and sample records visibly distinct wherever both counts appear. */
export function evidenceCountLabel(value: number, unit: "country" | "sample", t: (key: TextKey) => string,
  formatNumber: (value: number) => string): string {
  const locale = t("country") === "страна" ? "ru" : "en";
  const noun = pluralLabel(locale, value, t(unit),
    t(unit === "country" ? "countriesFew" : "samplesFew"), t(unit === "country" ? "countriesPlural" : "samples"));
  return `${formatNumber(value)} ${noun}`;
}
