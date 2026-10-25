import { YBP_BASE_YEAR } from "../shared/time";
import { LOG_RANGE_START_BCE } from "./constants";
import type { TextKey } from "./i18n";

type Translate = (key: TextKey) => string;
type TimePeriodBand = {
  key: string;
  label: TextKey;
  /** Civil calendar years: negative BCE, positive CE; null is the older axis edge. */
  startYear: number | null;
  endYear: number;
};

// A deliberately simplified composite guide, not one regional chronology.
// Archaeological periods overlap in reality. Sources and limitations are exposed
// in renderPeriodGuide; these bands never classify genetic results.
export const TIME_PERIOD_BANDS = [
  { key: "paleolithic", label: "periodPaleolithic", startYear: null, endYear: -LOG_RANGE_START_BCE },
  { key: "mesolithic", label: "periodMesolithic", startYear: -LOG_RANGE_START_BCE, endYear: -8000 },
  { key: "neolithic", label: "periodNeolithic", startYear: -8000, endYear: -5500 },
  { key: "chalcolithic", label: "periodChalcolithic", startYear: -5500, endYear: -3300 },
  { key: "bronze", label: "periodBronze", startYear: -3300, endYear: -1200 },
  { key: "iron", label: "periodIron", startYear: -1200, endYear: 500 },
  { key: "medieval", label: "periodMedieval", startYear: 500, endYear: 1500 },
  { key: "modern", label: "periodModern", startYear: 1500, endYear: YBP_BASE_YEAR },
] as const satisfies readonly TimePeriodBand[];

export function periodRange(period: TimePeriodBand, t: Translate, number: (value: number) => string = String): string {
  const year = (value: number) => `${number(Math.abs(value))} ${t(value < 0 ? "eraBceShort" : "eraCeShort")}`;
  if (period.startYear === null) return t("periodBefore").replace("{date}", year(period.endYear));
  return `${year(period.startYear)} – ${year(period.endYear)}`;
}

export function renderPeriodBandsMarkup(t: Translate): string {
  return TIME_PERIOD_BANDS.map(period =>
    `<span class="period-${period.key}" data-period-band="${period.key}" title="${t(period.label)}: ≈ ${periodRange(period, t)}"><span class="period-band-label" data-i18n="${period.label}">${t(period.label)}</span></span>`,
  ).join("");
}

export function renderPeriodGuide(t: Translate): string {
  return `<button type="button" class="period-guide-caveat" data-annotation="periods" aria-expanded="false" aria-controls="context-annotation" data-i18n="periodGuideCaveat">${t("periodGuideCaveat")}</button>`;
}

export function renderPeriodGuideContent(t: Translate): string {
  const source = (url: string, key: TextKey) => `<li><a href="${url}" tabindex="0" target="_blank" rel="noopener noreferrer" data-i18n="${key}">${t(key)}</a></li>`;
  return `<strong>${t("periodGuideCaveat")}</strong>
      <p data-i18n="periodGuideIntro">${t("periodGuideIntro")}</p>
      <p data-i18n="periodGuideRegions">${t("periodGuideRegions")}</p>
      <dl class="period-guide-ranges">${TIME_PERIOD_BANDS.map(period => `<div><dt data-i18n="${period.label}">${t(period.label)}</dt><dd data-period-range="${period.key}">${periodRange(period, t)}</dd></div>`).join("")}</dl>
      <p class="period-guide-endpoint" data-i18n="periodGuideEndpoint">${t("periodGuideEndpoint")}</p>
      <ul class="period-guide-sources">
        ${source("https://www.metmuseum.org/toah/ht/02/wae.html", "periodSourceEarly")}
        ${source("https://www.metmuseum.org/toah/ht/03/wae.html", "periodSourceMetals")}
        ${source("https://historicengland.org.uk/listing/the-list/historic-periods/", "periodSourceRegional")}
        ${source("https://www.dhm.de/en/exhibitions/permanent-exhibition/middle-ages/", "periodSourceMedieval")}
        ${source("https://www.yfull.com/faq/definitions/", "ageDefinitionSource")}
      </ul>
  `;
}
