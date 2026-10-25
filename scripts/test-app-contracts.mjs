import assert from "node:assert/strict";
import { ROOT, TEMP_ROOT, loadModule, stubModule } from "./app-contracts/runtime.mjs";
import { signatureRow, resultRow } from "./app-contracts/fixtures.mjs";
import { assertLazyCountryPills, assertSourceDateInversionContract, assertSameFormedTableGrouping } from "./app-contracts/table-contracts.mjs";
import { assertHeaderAndLanguageContracts, assertWordmarkCssContracts, assertDensityFormedLayerGrouping } from "./app-contracts/presentation-contracts.mjs";
import { assertNeutralButtonColorContracts, assertSourceDateFormatting, assertIndependentProvenanceMarkers, assertPublishedLegalAssets, assertSharedDialogAndResponsiveContracts } from "./app-contracts/static-contracts.mjs";
import { assertCountryPickerDisclosureContracts, assertLocalizedPresentationContracts } from "./app-contracts/country-localization-contracts.mjs";
import { assertAnalysisRequestContract, assertImmediateRecalculationContract, assertCountryMinimumReset } from "./app-contracts/analysis-contracts.mjs";
import { assertLocalePreservesQueryAndResultState, assertLocaleDoesNotResurrectPendingResults, assertLocalePreservesLoadRetry, assertResearchNavigationInvalidatesStaleRequests } from "./app-contracts/locale-research-contracts.mjs";
import { assertResearchEntityHistoryRestoresContext, assertWorkerResponseAndSupersessionContract, assertLatestOnlySchedulerContract, assertWholeCountryOverviewPartition } from "./app-contracts/research-worker-contracts.mjs";
import { assertTimelineScaleContracts, assertDensityIntervals, assertDensityMeasures } from "./app-contracts/timeline-contracts.mjs";
import { assertExactProfileLookupPriority, assertProfileLookupContract } from "./app-contracts/profile-lookup-contracts.mjs";
import { assertResultDetails } from "./app-contracts/result-detail-contracts.mjs";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { assertModuleLoaderContracts } from "./app-contracts/module-loader-contracts.mjs";
import { assertHierarchyMacrogroups } from "./app-contracts/macrogroup-contracts.mjs";
import { assertHistoryNamespaceMigration } from "./app-contracts/history-namespace-contracts.mjs";
import { assertLocalePreferences } from "./app-contracts/locale-preference-contracts.mjs";


try {
  await assertModuleLoaderContracts();
  stubModule("app/presets.ts", `
    export const COUNTRY_PRESETS = [
      {
        key: "test-preset",
        label: { en: "Test preset", ru: "Тестовый пресет" },
        category: { en: "Test group", ru: "Тестовая группа" },
        countries: ["AA", "BB", "CC"],
        kind: "country-code-proxy",
      },
    ];
    export const COUNTRY_PRESET_MAP = new Map(COUNTRY_PRESETS.map((preset) => [preset.key, preset]));
    export const DEFAULT_PRESET_COUNTRIES = [];
  `);

  await assertHistoryNamespaceMigration();
  await assertLocalePreferences();
  await assertHierarchyMacrogroups();
  const { matrixCountPaint } = await loadModule("app/matrix-colours.ts");
  assert.equal(matrixCountPaint(0,1000).background,"transparent");
  assert.equal(matrixCountPaint(1,1000).background,"rgb(247,251,255)");
  assert.equal(matrixCountPaint(1000,1000).background,"rgb(158,202,225)");
  for (let count=1;count<=1000;count++) {
    const paint=matrixCountPaint(count,1000);
    const channels=paint.background.match(/\d+/g).map(Number).map(value=>value/255);
    const linear=channels.map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
    const luminance=.2126*linear[0]+.7152*linear[1]+.0722*linear[2];
    const contrast=paint.foreground==="#ffffff"?1.05/(luminance+.05):(luminance+.05)/.05;
    assert.ok(contrast>=4.5,`Pastel Blues count ${count} must retain readable text`);
  }
  const queryModel = await loadModule("app/query-model.ts");
  const { YBP_BASE_YEAR, calendarYearToYbp, ybpToCalendarYear } = await loadModule("shared/time.ts");
  const { csvCell, formatDate, formatMachineDate } = await loadModule("app/format.ts");
  const { groupDensityFormedLayers } = await loadModule("app/density-model.ts");
  const { resultsCsvText } = await loadModule("app/export-csv.ts");
  const { createAnalysisController } = await loadModule("app/analysis-controller.ts");
  const { runtimeErrorSummary } = await loadModule("app/runtime-errors.ts");
  const { createWorkerClient } = await loadModule("app/worker-client.ts");
  const { createLocaleController } = await loadModule("app/locale-controller.ts");
  const { createResearchController } = await loadModule("app/research-controller.ts");
  const { createProfileLookup } = await loadModule("app/profile-lookup.ts");
  await assertProfileLookupContract(createProfileLookup);
  const { signatureOptionsForQuery } = await loadModule("worker/slice-analysis/signature-options.ts");
  assertExactProfileLookupPriority(signatureOptionsForQuery);
  const { renderProvenanceStrip, renderProvenanceNotes } = await loadModule("app/source-card.ts");
  const { renderAppShell } = await loadModule("app/shell.ts");
  const { renderCountryListHtml, renderCountryPresetsHtml, renderSelectedSummaryHtml } = await loadModule("app/country-panel.ts");
  const {
    MOBILE_RESULT_COUNTRY_CHIP_LIMIT,
    RESULT_COUNTRY_CHIP_LIMIT,
    TABLE_INITIAL_ROW_LIMIT,
    TABLE_ROW_INCREMENT,
  } = await loadModule("app/constants.ts");
  const { createLatestOnlyScheduler } = await loadModule("worker/latest-only.ts");
  const { countryOverviewForCountry } = await loadModule("worker/evidence-profile.ts");
  assertWholeCountryOverviewPartition(countryOverviewForCountry);
  await assertResultDetails();
  const { pluralLabel } = await loadModule("shared/plural.ts");
  const timeSlider = await loadModule("app/time-slider.ts");
  const timelineConstants = await loadModule("app/constants.ts");

  assert.equal(YBP_BASE_YEAR, 1950, "YBP calendar conversion must use the application's AD 1950 baseline");
  assert.equal(ybpToCalendarYear(5300), -3351, "5300 YBP must display as 3351 BCE without a year zero");
  assert.equal(calendarYearToYbp(-3351), 5300, "3351 BCE must query 5300 YBP");
  assert.equal(ybpToCalendarYear(1950), -1, "1950 YBP must display as 1 BCE");
  assert.equal(ybpToCalendarYear(1949), 1, "1949 YBP must display as 1 CE");
  assert.equal(calendarYearToYbp(-1), 1950, "1 BCE must query 1950 YBP");
  assert.equal(calendarYearToYbp(1), 1949, "1 CE must query 1949 YBP");
  assert.throws(() => calendarYearToYbp(0), /no year zero/);
  const { bindResultEvents, materializeCountryPills } = await loadModule("app/result-events.ts");
  const { availableResultMacroGroups, filterRowsByMacroGroup } = await loadModule("app/result-filter.ts");
  const {
    renderRows,
    renderTimeTableHead,
  } = await loadModule("results/table-renderer.ts");
  const { renderCountryPills } = await loadModule("results/country-pills.ts");
  const { contrastRatio, groupColor } = await loadModule("shared/colors.ts");
  const { countryFlag } = await loadModule("app/countries.ts");
  const [{ en }, { ru }] = await Promise.all([
    loadModule("app/i18n/en.ts"),
    loadModule("app/i18n/ru.ts"),

  ]);
  assertTimelineScaleContracts(timeSlider, timelineConstants, calendarYearToYbp, { en, ru, });
  assertDensityIntervals(await loadModule("app/density-intervals.ts"), timeSlider);
  assertDensityMeasures(await loadModule("app/density-measure.ts"));

  assert.match(en.branchSameAgeHint, /does not mean[^.]*simultaneously/i);
  assert.match(ru.branchSameAgeHint, /не означает[^.]*одновременно/i);
  assert.equal(en.densityMap, "Subclade formation times");
  assert.equal(ru.densityMap, "Время формирования субкладов");
  for (const [count, expected] of [[1, "образец"], [2, "образца"], [5, "образцов"], [21, "образец"], [22, "образца"], [25, "образцов"]]) {
    assert.equal(pluralLabel("ru", count, ru.sample, ru.samplesFew, ru.samples), expected);
  }
  for (const [count, expected] of [[1, "страна"], [2, "страны"], [5, "стран"], [21, "страна"], [22, "страны"], [25, "стран"]]) {
    assert.equal(pluralLabel("ru", count, ru.country, ru.countriesFew, ru.countriesPlural), expected);
  }
  assert.equal(runtimeErrorSummary("Unexpected token '<', <!doctype html>", (key) => en[key], "load"),
    "The data address returned a web page instead of the yNodus dataset.");
  assert.equal(runtimeErrorSummary("synthetic internal detail", (key) => ru[key], "analysis"),
    "Не удалось рассчитать текущий запрос.");

  const macroProjects = [
    "A", "A0", "A0-T", "A00", "A1", "A1a", "A1b1", "B", "BT", "C", "CF", "CT",
    "D", "DE", "E", "F", "F-Y27277", "F1", "F2", "F3", "G", "GHIJK", "H", "HIJK",
    "I", "I1", "I2", "IJ", "IJK", "J", "J1", "J2", "K", "K-Y28299", "K2", "L", "LT",
    "M", "N", "NO", "O", "P", "Q", "R", "R1", "R1a", "R1b", "R2", "S", "T",
  ];
  const { groupFillColor } = await loadModule("shared/group-palette.ts");
  assert.equal(groupFillColor("R1a"), "#F8766D", "classic ggplot2 hue starts at 15 degrees");
  assert.equal(new Set(macroProjects.map(groupFillColor)).size, macroProjects.length,
    "fixed ggplot2 levels keep every source group distinct across country selections");
  assert.ok(macroProjects.every(project => contrastRatio("#183337", groupFillColor(project)) >= 4.5),
    "below-bar labels remain readable on every ggplot2 fill");
  assert.equal(new Set(macroProjects.map(groupColor)).size, macroProjects.length,
    "every current project macrogroup must keep a distinct supplementary table color");
  assert.ok(macroProjects.every((project) => contrastRatio(groupColor(project), "#ffffff") >= 4.5),
    "every macrogroup label color must retain WCAG AA contrast on the result ledger");
  assert.match(countryFlag("ENG", "en"), /fi-gb-eng/,
    "England must use its visible subdivision flag instead of the generic UK flag");
  assert.match(countryFlag("SCT", "ru"), /fi-gb-sct/);
  assert.match(countryFlag("WLS", "en"), /fi-gb-wls/);
  assert.doesNotMatch(countryFlag("ANT", "en"), /fi-an/,
    "obsolete codes without a packaged asset must use the explicit missing-flag marker");

  assert.equal(queryModel.normalizeMinResultSamples(4.6), 5);
  assert.equal(queryModel.normalizeMinResultSamples(-3), 0);
  assert.equal(queryModel.normalizeMinResultSamples(Number.NaN), 0);

  assertDensityFormedLayerGrouping(groupDensityFormedLayers);

  const preset = {
    key: "synthetic",
    label: "Synthetic",
    category: "Synthetic",
    countries: ["AA", "BB", "ZZ"],
  };
  const index = { countries: new Map([["AA", 1], ["BB", 100]]) };
  assert.deepEqual(queryModel.availablePresetCountries(index, preset), ["AA", "BB"]);
  assert.deepEqual(queryModel.availablePresetCountries(null, preset), ["AA", "BB", "ZZ"]);
  assert.deepEqual(
    [...queryModel.retainAvailableCountries(index, new Set(["AA", "ZZ"]))],
    ["AA"],
  );
  assert.deepEqual(
    [...queryModel.retainAvailableCountries(index, new Set(["ZZ"]))],
    [],
    "invalid persisted countries must not expand to every indexed country",
  );

  assert.deepEqual(
    queryModel.analysisCountryScope(new Set(["BB", "AA"])),
    { selectedCountries: ["AA", "BB"], scopeAllCountries: false },
  );
  assert.deepEqual(
    queryModel.analysisCountryScope(new Set()),
    { selectedCountries: [], scopeAllCountries: false },
  );
  assert.equal(queryModel.analysisScopeIsValid(new Set()), false);
  assert.equal(queryModel.analysisScopeIsValid(new Set(["AA"])), true);

  const anchor = signatureRow("R-ANCHOR", 12, [["AA", 5], ["BB", 7]]);
  assert.equal(queryModel.cohortSampleCount(index, new Set()), 0);
  assert.equal(queryModel.cohortSampleCount(index, new Set(["AA"])), 1);
  assert.equal(queryModel.cohortSampleCount(index, new Set(["AA", "BB"])), 101);

  const rRow = resultRow("R-ROW", 4, "formed-in-slice");
  const iRow = resultRow("I-ROW", 3, "formed-in-slice");
  iRow.node.project = "I1";
  assert.deepEqual(availableResultMacroGroups([rRow, iRow]), ["I1", "R"]);
  assert.deepEqual(filterRowsByMacroGroup([rRow, iRow], "I1"), [iRow]);
  assert.deepEqual(filterRowsByMacroGroup([rRow, iRow], null), [rRow, iRow]);

  for (const marker of ["=", "+", "-", "@"]) {
    for (const prefix of ["", "  ", "\t"]) {
      const value = `${prefix}${marker}unsafe`;
      assert.equal(csvCell(value).startsWith("'"), true, `formula-safe CSV cell: ${JSON.stringify(value)}`);
    }
  }
  assert.equal(csvCell('plain,"quoted"'), '"plain,""quoted"""');
  assert.equal(csvCell("line\r\nbreak"), '"line\r\nbreak"');

  const crossing = resultRow("R-PARENT", 8, "crossing-through", "R-CHILD");
  const crossingCsv = resultsCsvText({
    formedRows: [],
    crossingRows: [crossing],
    selectedCountries: ["AA"],
    presenceMode: "any",
    minResultSamples: 7,
    targetYbp: 5500,
    targetYear: "3500",
    targetEra: "BCE",
    macroGroupFilter: "R",
    crossingMacroGroupFilter: "R",
    formatCalendar: (value) => `${value} ybp`,
    subcladeUrl: (id) => `https://example.test/${id}`,
  });
  assert.match(crossingCsv, /^presence_mode,result_mode,min_result_samples,target_ybp,target_calendar,/);
  const [crossingHeader, crossingValues] = crossingCsv.split("\n").map((line) => line.split(","));
  assert.equal(crossingValues[crossingHeader.indexOf("result_identity")], "R-PARENT > R-CHILD");
  assert.equal(crossingValues[crossingHeader.indexOf("subclade")], "R-PARENT");
  assert.equal(crossingValues[crossingHeader.indexOf("crossing_child")], "R-CHILD");
  assert.equal(crossingValues[crossingHeader.indexOf("path")], "R-PARENT > R-CHILD");
  assert.equal(crossingValues[crossingHeader.indexOf("macrogroup_filter")], "R");
  assert.equal(crossingValues[crossingHeader.indexOf("macrogroup")], "R");
  assert.equal(
    crossingValues[crossingHeader.indexOf("delta_ybp")],
    "",
    "Crossing must leave formed deviation empty",
  );
  assert.match(crossingCsv, /https:\/\/example\.test\/R-PARENT,https:\/\/example\.test\/R-CHILD,/m);
  assertSourceDateInversionContract(resultsCsvText, renderRows, en);
  assertSameFormedTableGrouping(
    resultsCsvText,
    renderRows,
    renderTimeTableHead,
    en,
    ru,
  );

  await assertAnalysisRequestContract(createAnalysisController, anchor, crossing);
  await assertImmediateRecalculationContract(createAnalysisController, anchor, crossing);
  await assertCountryMinimumReset(createAnalysisController, crossing);
  assertLocalePreservesQueryAndResultState(createLocaleController, { en, ru, });
  assertLocaleDoesNotResurrectPendingResults(createLocaleController);
  assertLocalePreservesLoadRetry(createLocaleController);
  await assertResearchNavigationInvalidatesStaleRequests(createResearchController);
  await assertResearchEntityHistoryRestoresContext(createResearchController);
  await assertWorkerResponseAndSupersessionContract(createWorkerClient, crossing);
  assertLatestOnlySchedulerContract(createLatestOnlyScheduler);
  assertLazyCountryPills(
    renderCountryPills,
    materializeCountryPills,
    RESULT_COUNTRY_CHIP_LIMIT,
    MOBILE_RESULT_COUNTRY_CHIP_LIMIT,
  );
  assert.equal(TABLE_INITIAL_ROW_LIMIT, 50, "broad result sets must start with a readable leading page");
  assert.equal(TABLE_ROW_INCREMENT, 50, "Show more must reveal results progressively");
  assertLocalizedPresentationContracts({ en, ru, });
  assertHeaderAndLanguageContracts(renderAppShell, en);
  assertSourceDateFormatting(formatDate, formatMachineDate);
  assertIndependentProvenanceMarkers(renderProvenanceStrip, en, renderProvenanceNotes);
  assertCountryPickerDisclosureContracts(renderCountryListHtml, renderSelectedSummaryHtml, renderCountryPresetsHtml, en);
  assertPublishedLegalAssets();
  assertSharedDialogAndResponsiveContracts();
  assertWordmarkCssContracts();
  assertNeutralButtonColorContracts();

  console.log("App contract test passed: module imports, query, preset, provenance, header/language, country disclosure, subclade, i18n, and CSV safety.");
} finally {
  await fsPromises.rm(TEMP_ROOT, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
