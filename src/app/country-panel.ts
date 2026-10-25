import { escapeHtml } from "../shared/html";
import { pluralLabel } from "../shared/plural";
import type { CountryPreset, Locale, TreeIndexSummary as TreeIndex } from "../shared/types";
import { COUNTRY_PRESETS } from "./presets";
import {
  availablePresetCountries,
  normalizeCountrySearch,
  sameCountrySelection,
} from "./query-model";
import type { TextKey } from "./i18n";
import { renderPresetInfo } from "./preset-info";
import {
  countryRegionKey,
  countryRegionOrder,
  type CountryRegionKey,
} from "./country-regions";

const SELECTED_COUNTRY_COLLAPSE_AT = 2;
const SELECTED_COUNTRY_FALLBACK_LIMIT = 3;

export type CountryPanelContext = {
  index: TreeIndex | null;
  activePreset: string | null;
  selectedCountries: Set<string>;
  countryFilter: string;
  locale: Locale;
  t: (key: TextKey) => string;
  localizedText: (value: CountryPreset["label"]) => string;
  countryName: (code: string) => string;
  countryFlag: (code: string) => string;
  formatNumber: (value: number) => string;
};

type CountryListItem = {
  code: string;
  count: number;
  name: string;
  region: CountryRegionKey;
  searchText: string;
};

type CountryListCache = {
  items: CountryListItem[];
  orderByCode: Map<string, number>;
};

const countryListCacheByIndex = new WeakMap<TreeIndex, Map<Locale, CountryListCache>>();

export function countrySelectionCountLabel(context: CountryPanelContext): string {
  return `${context.t("selected")}: ${countryCountText(context.selectedCountries.size, context)}`;
}

export function renderCountryListHtml(context: CountryPanelContext): string {
  if (!context.index) {
    return `<div class="muted-block">${context.t("emptyLoad")}</div>`;
  }

  const query = normalizeCountrySearch(context.countryFilter);
  const selectedCountLabel = countrySelectionCountLabel(context);
  const filteredItems = countryListCacheFor(context).items
    .filter((item) => !query || item.searchText.includes(query));
  const groups = new Map<CountryRegionKey, CountryListItem[]>();
  for (const item of filteredItems) {
    const regionItems = groups.get(item.region) ?? [];
    regionItems.push(item);
    groups.set(item.region, regionItems);
  }
  const items = [...groups.entries()]
    .sort(([left], [right]) => countryRegionOrder(left) - countryRegionOrder(right))
    .map(([region, regionItems]) => {
      const options = regionItems.map((item) => {
      const checked = context.selectedCountries.has(item.code) ? "checked" : "";
      const accessibleName = `${item.name} (${item.code}), ${sampleCountText(item.count, context)}`;
      return `
        <label class="country-option">
          <input type="checkbox" value="${escapeHtml(item.code)}" data-country-code="${escapeHtml(item.code)}" aria-label="${escapeHtml(accessibleName)}" ${checked} />
          <span class="flag" aria-hidden="true">${context.countryFlag(item.code)}</span>
          <span class="country-text">
            <span class="country-name">${escapeHtml(item.name)}</span>
            <strong class="country-code">${escapeHtml(item.code)}</strong>
            <em>${context.formatNumber(item.count)}</em>
          </span>
        </label>
      `;
      }).join("");
      return `
        <section class="country-continent-group" data-country-region="${region}">
          <h3>
            <span>${escapeHtml(countryRegionLabel(region, context))}</span>
            <small>${context.formatNumber(regionItems.length)}</small>
          </h3>
          <div class="country-continent-grid">${options}</div>
        </section>
      `;
    }).join("");

  return `
    <div class="country-list-status">
      <span data-country-selection-count>${escapeHtml(selectedCountLabel)}</span>
      <span class="country-count-unit">${escapeHtml(context.t("countrySampleCountHeading"))}</span>
      <span class="country-list-actions">
        <button class="small-button" type="button" data-country-action="all" title="${escapeHtml(context.t("tooltipSelectAll"))}" data-tooltip="${escapeHtml(context.t("tooltipSelectAll"))}">${context.t("selectAll")}</button>
        <button class="small-button" type="button" data-country-action="none" title="${escapeHtml(context.t("tooltipSelectNone"))}" data-tooltip="${escapeHtml(context.t("tooltipSelectNone"))}">${context.t("clearAll")}</button>
      </span>
    </div>
    ${items || `<div class="muted-block">${context.t("noCountrySearchMatches")}</div>`}
  `;
}

export function renderCountryPresetsHtml(context: CountryPanelContext): string {
  const groups = new Map<TextKey, CountryPreset[]>([
    ["presetGroupRegional", []], ["presetGroupLanguage", []], ["presetGroupArchaeology", []],
  ]);
  for (const preset of COUNTRY_PRESETS) {
    const category: TextKey = preset.key.startsWith("arch-") ? "presetGroupArchaeology"
      : preset.kind === "country-code-proxy" ? "presetGroupLanguage" : "presetGroupRegional";
    const presets = groups.get(category) ?? [];
    presets.push(preset);
    groups.set(category, presets);
  }

  const activePreset = context.activePreset
    ? COUNTRY_PRESETS.find((preset) => preset.key === context.activePreset) ?? null
    : null;
  const activeIsExact = Boolean(
    activePreset && sameCountrySelection(
      context.selectedCountries,
      availablePresetCountries(context.index, activePreset),
    ),
  );

  return `
    <button class="preset-mobile-toggle" type="button" data-toggle-presets aria-expanded="false" aria-controls="country-presets-browser">${context.t("presetSelect")}</button>
    <section id="country-presets-browser" class="preset-browser" aria-label="${context.t("presetSelect")}">
      <header class="preset-browser-heading">
        <span>${context.t("conditionalPresets")}</span>
        <p class="preset-intro">${context.t("presetIntro")}</p>
        ${activePreset && activeIsExact
          ? `<strong>${context.t("presetActive")}: ${escapeHtml(context.localizedText(activePreset.label))}</strong>`
          : `<strong>${context.t("choosePreset")}</strong>`}
      </header>
      <div class="preset-browser-body">
        <div class="preset-menu" role="group" aria-label="${context.t("conditionalPresets")}">
          ${[...groups.entries()]
            .filter(([, presets]) => presets.length > 0)
            .map(([category, presets]) => renderPresetGroup(category, presets, context, activeIsExact))
            .join("")}
        </div>
        <p class="preset-explanation">${context.t("presetExplanation")}</p>
        <p class="preset-methodology-note">${context.t("presetMethodologyExplanation")}</p>
      </div>
    </section>
  `;
}

export function renderSelectedSummaryHtml(context: CountryPanelContext): string {
  const countryOrder = context.index
    ? countryListCacheFor(context).orderByCode
    : null;
  const selected = [...context.selectedCountries].sort((a, b) =>
    (countryOrder?.get(a) ?? Number.MAX_SAFE_INTEGER) -
    (countryOrder?.get(b) ?? Number.MAX_SAFE_INTEGER) ||
    a.localeCompare(b),
  );

  if (selected.length === 0) {
    return `<div class="selected-empty">${context.t("noCountriesSelected")}</div>`;
  }

  const chip = (code: string) => {
    const count = selectedCountryCount(context, code);
    const countHtml = count === undefined
      ? ""
      : `<strong class="selected-count">${context.formatNumber(count)}</strong>`;
    const chipTitle = selectedCountryTitle(context, code, count);
    return `
      <span class="selected-chip" role="group" aria-label="${escapeHtml(chipTitle)}">
        <span class="flag" aria-hidden="true">${context.countryFlag(code)}</span>
        <span class="selected-code">${escapeHtml(code)}</span>
        ${countHtml}
        <button class="chip-remove" type="button" data-remove-country="${escapeHtml(code)}" aria-label="${context.t("removeCountry")} ${escapeHtml(context.countryName(code))}">&times;</button>
      </span>
    `;
  };

  const selectedCountLabel = `${context.t("selected")}: ${countryCountText(selected.length, context)}`;
  const selectedMeta = `
    <span class="selected-runway-meta" aria-label="${escapeHtml(selectedCountLabel)}">
      <strong>${context.formatNumber(selected.length)}</strong>
      <span>${context.t("selected").toLowerCase()}</span>
    </span>
  `;

  if (selected.length < SELECTED_COUNTRY_COLLAPSE_AT) {
    return `<div class="selected-chips-row"><div class="selected-chips">${selected.map(chip).join("")}</div>${selectedMeta}</div>`;
  }

  const initialLimit = Math.min(SELECTED_COUNTRY_FALLBACK_LIMIT, selected.length - 1);
  const visible = selected.slice(0, initialLimit);
  const hidden = selected.slice(initialLimit);
  return `
    <div class="selected-chips-row">
      <div class="selected-chips">
        ${visible.map(chip).join("")}
        <details class="selected-more">
          <summary><span class="disclosure-more">${countryPanelMoreItemsLabel(hidden.length, context)}</span><span class="disclosure-less">${context.t("showFewer")}</span></summary>
          <div class="chip-popover">${hidden.map(chip).join("")}</div>
        </details>
      </div>
      ${selectedMeta}
    </div>
  `;
}

function selectedCountryCount(context: CountryPanelContext, code: string): number | undefined {
  return context.index?.countries.get(code);
}

function selectedCountryTitle(
  context: CountryPanelContext,
  code: string,
  count: number | undefined,
): string {
  const countText = count === undefined
    ? ""
    : ` · ${sampleCountText(count, context)}`;
  return `${context.countryName(code)}${countText}`;
}

export function countryPanelMoreItemsLabel(
  count: number,
  context: Pick<CountryPanelContext, "formatNumber"> & { locale: Locale },
): string {
  if (context.locale === "ru") return `Показать ещё ${context.formatNumber(count)}`;
  return `Show ${context.formatNumber(count)} more`;
}

function renderPresetGroup(
  category: TextKey,
  presets: CountryPreset[],
  context: CountryPanelContext,
  originExact: boolean,
): string {
  return `
    <details class="preset-menu-group" data-preset-group="${category}" ${presets.some(p => p.key === context.activePreset) || (!context.activePreset && category === "presetGroupRegional") ? "open" : ""}>
      <summary class="preset-menu-group-title"><span>${escapeHtml(context.t(category))}</span><small>${context.formatNumber(presets.length)}</small></summary>
      <div class="preset-menu-grid">
        ${presets.map((preset) => renderPresetOption(preset, context, originExact)).join("")}
      </div>
    </details>
  `;
}

function renderPresetOption(
  preset: CountryPreset,
  context: CountryPanelContext,
  originExact: boolean,
): string {
  const isOrigin = context.activePreset === preset.key;
  const isActive = isOrigin && originExact;
  const members = preset.countries;
  const effectiveCount = availablePresetCountries(context.index, preset).length;
  const meta = countryCountText(effectiveCount, context);
  const proxyNote = preset.kind === "country-code-proxy"
    ? context.t("presetProxyNote")
    : "";
  const memberId = `preset-members-${preset.key.replace(/[^a-z0-9_-]/gi, "-")}`;
  const accessibleName = [
    `${context.localizedText(preset.label)} · ${meta}.`,
    proxyNote,
    context.t("presetApplyHint"),
  ].filter(Boolean).join(" ");
  const previewMembers = members.slice(0, 3);
  const previewRemaining = Math.max(0, members.length - previewMembers.length);
  return `
    <div class="preset-option-wrap${isActive ? " active" : ""}">
      <button class="preset-option-button" type="button" data-country-preset-option="${escapeHtml(preset.key)}" aria-pressed="${String(isActive)}" aria-label="${escapeHtml(accessibleName)}">
        <span>${escapeHtml(context.localizedText(preset.label))}</span>
        <em>${escapeHtml(meta)}</em>
        ${proxyNote ? `<small class="preset-proxy-badge">${escapeHtml(context.t("presetProxyBadge"))}</small>` : ""}
        <span class="preset-option-flags" aria-hidden="true">
          ${previewMembers.map((code) => `<span class="flag">${context.countryFlag(code)}</span>`).join("")}
          ${previewRemaining > 0 ? `<small>+${context.formatNumber(previewRemaining)}</small>` : ""}
        </span>
        <i aria-hidden="true">✓</i>
      </button>
      <button class="preset-info-trigger" type="button" data-preset-info="${escapeHtml(preset.key)}" aria-controls="${memberId}" aria-expanded="false" aria-label="${escapeHtml(`${context.t("presetAbout")}: ${context.localizedText(preset.label)}`)}">ⓘ</button>
      <div id="${memberId}" class="preset-members-tooltip" role="region" aria-label="${escapeHtml(`${context.t("presetAbout")}: ${context.localizedText(preset.label)}`)}">
        <div class="preset-card-heading"><div><small>${context.t("presetAbout")}</small><strong>${escapeHtml(context.localizedText(preset.label))}</strong></div><button type="button" data-preset-card-close aria-label="${context.t("presetInfoClose")}">×</button></div>
        <h3>${context.t("presetCountriesTitle")}</h3>
        <span class="preset-tooltip-members">
          ${members.map((code) => `
            <span class="preset-member">
              <span class="flag" aria-hidden="true">${context.countryFlag(code)}</span>
              <span>${escapeHtml(context.countryName(code))}</span>
              <code>${escapeHtml(code)}</code>
            </span>
          `).join("")}
        </span>
        ${proxyNote ? `<p>${escapeHtml(proxyNote)}</p>` : ""}
        ${renderPresetInfo(preset, context)}
      </div>
    </div>
  `;
}

function countryRegionLabel(
  region: CountryRegionKey,
  context: Pick<CountryPanelContext, "t">,
): string {
  const labels: Record<CountryRegionKey, TextKey> = {
    africa: "continentAfrica",
    asia: "continentAsia",
    europe: "continentEurope",
    northAmerica: "continentNorthAmerica",
    southAmerica: "continentSouthAmerica",
    oceania: "continentOceania",
    other: "continentOther",
  };
  return context.t(labels[region]);
}

function countryCountText(
  count: number,
  context: Pick<CountryPanelContext, "formatNumber" | "locale" | "t">,
): string {
  const noun = pluralLabel(
    context.locale,
    count,
    context.t("country"),
    context.t("countriesFew"),
    context.t("countriesPlural"),
  );
  return `${context.formatNumber(count)} ${noun}`;
}

function sampleCountText(
  count: number,
  context: Pick<CountryPanelContext, "formatNumber" | "locale" | "t">,
): string {
  const noun = pluralLabel(
    context.locale,
    count,
    context.t("sample"),
    context.t("samplesFew"),
    context.t("samples"),
  );
  return `${context.formatNumber(count)} ${noun}`;
}

function countryListCacheFor(context: CountryPanelContext): CountryListCache {
  if (!context.index) return { items: [], orderByCode: new Map() };

  const byLocale = countryListCacheByIndex.get(context.index) ?? new Map<Locale, CountryListCache>();
  const cached = byLocale.get(context.locale);
  if (cached) return cached;

  const items = [...context.index.countries.entries()]
    .map(([code, count]) => {
      const name = context.countryName(code);
      return {
        code,
        count,
        name,
        region: countryRegionKey(code),
        searchText: normalizeCountrySearch(`${code} ${name}`),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.code.localeCompare(b.code));
  const orderByCode = new Map(items.map((item, index) => [item.code, index]));
  const nextCache = { items, orderByCode };

  byLocale.set(context.locale, nextCache);
  countryListCacheByIndex.set(context.index, byLocale);
  return nextCache;
}
