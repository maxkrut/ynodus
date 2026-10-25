import {
  MOBILE_RESULT_COUNTRY_CHIP_LIMIT,
  RESULT_COUNTRY_CHIP_LIMIT,
} from "../app/constants";
import { escapeHtml } from "../shared/html";
import type { ResultTableRenderContext } from "./table-renderer";
import { renderAnnotation } from "../app/annotation-markup";

export function renderCountryPills(
  entries: [string, number][],
  context: ResultTableRenderContext,
  belowMinimumEntries: [string, number][] = [],
  action = "",
): string {
  const inactiveCodes = new Set(belowMinimumEntries.map(([code]) => code));
  const displayEntries: CountryPillEntry[] = [
    ...entries.filter(([code]) => !inactiveCodes.has(code)),
    ...belowMinimumEntries.map(([code, count]): CountryPillEntry => [code, count, context.t("countryBelowMinimum")]),
  ];
  const render = ([code, count, status]: CountryPillEntry) =>
    renderCountryPill(code, context.formatNumber(count), context.countryFlag, status);

  const limit = context.countryChipLimit
    ?? (typeof window !== "undefined" && window.innerWidth <= 760
      ? MOBILE_RESULT_COUNTRY_CHIP_LIMIT
      : RESULT_COUNTRY_CHIP_LIMIT);

  if (displayEntries.length <= limit) {
    return renderCountryPillSet(displayEntries, displayEntries.length, "country-pills-all", render, context, action);
  }

  // Keep the legacy viewport hooks for downstream selectors while rendering only one set.
  return renderCountryPillSet(
    displayEntries,
    limit,
    "country-pills-responsive country-pills-desktop country-pills-mobile",
    render,
    context,
    action,
  );
}

type CountryPillEntry = [code: string, count: number, status?: string];

export function renderCountryPill(
  code: string, count: string, renderFlag: (code: string) => string, status?: string,
): string {
  return `<span class="country-pill${status ? " country-pill-inactive" : ""}">
    <span class="flag">${renderFlag(code)}</span>
    <span class="country-code">${escapeHtml(code)}</span>
    <strong>${escapeHtml(count)}</strong>
    ${status ? renderAnnotation("country-minimum", () => `${code}: ${status}`) : ""}
  </span>`;
}

function renderCountryPillSet(
  entries: CountryPillEntry[],
  limit: number,
  viewportClass: string,
  render: (entry: CountryPillEntry) => string,
  context: ResultTableRenderContext,
  action: string,
): string {
  const visibleEntries = entries.slice(0, limit);
  if (entries.length <= limit) {
    return `<div class="country-pills-viewport ${viewportClass}"><div class="pill-row">${visibleEntries.map(render).join("")}${action}</div></div>`;
  }

  const hiddenPayload = JSON.stringify(
    entries.slice(limit).map(([code, count, status]) => status
      ? [code, context.formatNumber(count), status]
      : [code, context.formatNumber(count)]),
  );
  return `
    <div class="country-pills-viewport ${viewportClass}">
      <div class="pill-row">
        ${visibleEntries.map(render).join("")}
        <details
          class="chip-details"
          data-lazy-country-pills="${escapeHtml(hiddenPayload)}"
        >
          <summary><span class="disclosure-more">${context.moreItemsLabel(entries.length - limit)}</span><span class="disclosure-less">${context.t("showFewer")}</span></summary>
          <div class="chip-popover" data-country-pill-popover></div>
        </details>
        ${action}
      </div>
    </div>
  `;
}
