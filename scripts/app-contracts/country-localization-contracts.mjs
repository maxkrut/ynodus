import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./runtime.mjs";
import {
  analyzePayload, analysisState, analysisResult, analysisSliceResult,
  fakeWorker, fakeElement, fakeEventTarget, signatureRow, resultRow,
  captureCommittedQuery, provenanceIndex,
} from "./fixtures.mjs";

export function assertCountryPickerDisclosureContracts(renderCountryListHtml, renderSelectedSummaryHtml, renderCountryPresetsHtml, en) {
  const selectedCodes = Array.from({ length: 12 }, (_, index) => `C${String(index).padStart(2, "0")}`);
  const countries = new Map([
    ...selectedCodes.map((code, index) => [code, index + 1]),
    ["AA", 101],
    ["BB", 102],
    ["CC", 103],
    ["RUS", 104],
    ["CHN", 105],
    ["BRA", 106],
  ]);
  const context = {
    index: { ...provenanceIndex(), countries },
    activePreset: null,
    selectedCountries: new Set(selectedCodes),
    countryFilter: "",
    signatureSource: null,
    locale: "en",
    t: (key) => en[key] ?? key,
    localizedText: (value) => typeof value === "string" ? value : value.en,
    countryName: (code) => `Country ${code}`,
    countryFlag: (code) => `flag-${code}`,
    formatNumber: String,
  };

  const selectedMarkup = renderSelectedSummaryHtml(context);
  const detailsStart = selectedMarkup.indexOf('<details class="selected-more">');
  assert.ok(detailsStart > 0, "ten or more selected countries must use progressive disclosure");
  assert.equal(
    [...selectedMarkup.slice(0, detailsStart).matchAll(/<span class="selected-chip(?:\s|\")/g)].length,
    3,
    "the initial fallback contains three chips before width-based browser layout",
  );
  assert.match(selectedMarkup, /<details class="selected-more">\s*<summary><span class="disclosure-more">Show 9 more<\/span><span class="disclosure-less">Show fewer<\/span><\/summary>/);
  assert.match(selectedMarkup, /<div class="chip-popover">[\s\S]*data-remove-country="C11"/);
  assert.match(selectedMarkup, /<strong>12<\/strong>\s*<span>selected<\/span>/);

  const countryListMarkup = renderCountryListHtml(context);
  assert.match(countryListMarkup, /data-country-region="europe"[\s\S]*Country RUS/);
  assert.match(countryListMarkup, /data-country-region="asia"[\s\S]*Country CHN/);
  assert.match(countryListMarkup, /data-country-region="southAmerica"[\s\S]*Country BRA/);
  assert.match(countryListMarkup, /class="country-continent-grid"/,
    "the country checklist must expose continent sections without changing checkbox semantics");
  assert.ok(countryListMarkup.includes(en.countrySampleCountHeading),
    "visible country counts must state that they are source-recorded samples");
  assert.match(countryListMarkup, /Selected: 12 countries/,
    "the selected-country count must read naturally in its locale");

  const presetMarkup = renderCountryPresetsHtml({
    ...context,
    activePreset: "test-preset",
    selectedCountries: new Set(["AA", "BB", "CC"]),
  });
  assert.match(presetMarkup, /<section[^>]*class="preset-browser"/);
  assert.match(presetMarkup, /data-country-preset-option="test-preset"[^>]*aria-pressed="true"/);
  assert.match(presetMarkup, /class="preset-methodology-note"/,
    "the country picker must visibly explain what all presets select");
  assert.ok(
    presetMarkup.indexOf('class="preset-menu"') < presetMarkup.indexOf('class="preset-explanation"'),
    "preset actions must appear before supporting methodology copy in the scrollable preset pane",
  );
  assert.match(presetMarkup, /class="preset-proxy-badge">thematic country list</,
    "culturally named country-code shortcuts must be visibly classified as proxies");
  assert.match(presetMarkup, /not an archaeological sample set or a reconstructed range/,
    "proxy methodology must remain available to pointer and keyboard users");
  assert.match(
    presetMarkup,
    /class="preset-members-tooltip" role="region"[^>]*>[\s\S]*Country AA[\s\S]*<code>AA<\/code>[\s\S]*Country CC/,
    "preset membership must be available in the explicit details card",
  );
  assert.doesNotMatch(presetMarkup, /data-preset-members-toggle|preset-apply-button|applyPreset/,
    "a preset itself must be the single direct apply action");
  assert.doesNotMatch(presetMarkup, /Manual selection|manualSelection/,
    "country selection is one model, not a separate manual mode");

  const countryEventsSource = fs.readFileSync(path.join(ROOT, "src/app/country-events.ts"), "utf8");
  assert.ok(
    (countryEventsSource.match(/state\.activePreset\s*=\s*null;/g) ?? []).length >= 3,
    "checkbox, bulk and chip edits must all clear the active preset",
  );
}

export function assertLocalizedPresentationContracts(locales) {
  assert.equal(locales.ru.target, "Дата поиска");
  assert.equal(locales.ru.maxDelta, "Допуск, лет");
  assert.equal(locales.ru.anyCountry, "Все ветви");
  assert.equal(locales.ru.everyCountry, "Общие ветви");
  assert.equal(locales.ru.formedResults, "Ветви с оценкой формирования");
  assert.equal(locales.en.formedResults, "Branches with a formation-age estimate");
  assert.equal(locales.ru.exploreTime, "Страны образцов и время");
  assert.equal(locales.en.exploreTime, "Countries in sample records & time");
  assert.doesNotMatch(locales.ru.tooltipExportCsv, /закоммич/i);
  assert.equal(locales.ru.profileSubtreeEvidence, "Образцы в этой ветви");
  assert.equal(locales.ru.profileCountryEvidence, "Образцы по кодам стран в записях");
  assert.equal(locales.ru.crossingResults, "Переходы через выбранную дату");
  assert.equal(locales.ru.queryEvidenceLabel, "Страны образцов");
  for (const value of Object.values(locales.ru)) {
    assert.doesNotMatch(value, /датированные свидетельства|поддержка поддерева|непосредственные поддержанные ветви|ветви, сформировавшиеся|показана как сформировавшаяся|более ранний слой|более поздний слой|текущие результаты Formed|расстояние, лет|возраст верхней ветви|закрыть детали ветви|ограничить поиск его ветвью/i);
  }
  for (const locale of [locales.en, locales.ru]) {
    assert.ok(locale.countryEvidenceMethod.length > 40);
    assert.ok(locale.samplingBiasCaveat.length > 40);
    assert.ok(locale.absenceCaveat.length > 30);
    assert.ok(locale.nestedCountsCaveat.length > 30);
    assert.ok(locale.branchSourceAgeHint.length > 30);
  }
  assert.match(locales.en.countryEvidenceMethod, /do not identify.*historical residence/i);
  assert.match(locales.en.samplingBiasCaveat, /not a population-representative survey/i);
  assert.match(locales.en.absenceCaveat, /not evidence.*historically absent/i);
  assert.match(locales.ru.countryEvidenceMethod, /не показывает, где жил предок/i);

  const targetControlsSource = fs.readFileSync(path.join(ROOT, "src/app/target-controls.ts"), "utf8");
  const targetDensitySource = fs.readFileSync(path.join(ROOT, "src/app/target-density.ts"), "utf8");
  const densityBucketSource = fs.readFileSync(path.join(ROOT, "src/app/density-bucket-view.ts"), "utf8");
  assert.doesNotMatch(densityBucketSource, /densityBucketMatchLine\("matches"/);
  assert.doesNotMatch(densityBucketSource, /`\$\{label\}: none`/);
  assert.match(targetControlsSource, /context\.t\("eraBceShort"\)/);
  assert.match(densityBucketSource, /context\.t\("densityBucketMacroGroups"\)/);
  assert.match(densityBucketSource, /class="density-macro-stack"/,
    "the context map must encode each fixed time bucket by macrogroup colour");
  assert.doesNotMatch(targetDensitySource, /const visibleLayers\s*=\s*groupDensityFormedLayers\(visibleRows/,
    "density rendering must not regroup every visible row once globally and then again per bucket");
  assert.match(targetControlsSource, /if \(renderDensity\) renderAxisDensity[\s\S]*else updateHitWindow/,
    "pending query updates must be able to update the target window without rebuilding density");

}
