# Changelog

## 1.2.1 - 2026-10-26

- Use whole-dataset country totals for the selected sample type (all, ancient or modern) when applying the Common branches threshold. Date, window and chart bins no longer change required countries.
- Apply the same country rule to Formed, Crossing, chart subclades and nearest-date suggestions; retain optional countries in sample counts and faded flags. Zero still requires every selected country.
- Explain the dataset threshold in Russian and English, update CSV `min_samples_basis`, and remove the redundant “Compare with these countries” action.

## 1.2.0 - 2026-10-25

### Added

- Optional timeline grouping by a known direct parent and identical Formed
  estimate, alongside the existing subclade count. Help distinguishes these
  descriptive groups from independent historical events.
- An explicit comparison action keeps the current window's participating
  countries and sets the minimum to zero, making that country set required
  throughout the chart and results.

### Changed

- Country exploration starts with a compact macrogroup summary. Profiles and
  result details initially show the root and immediate children; deeper levels,
  country filters, macrogroup filters and search remain available on demand.
- Result actions align consistently; branch-composition explanations live in
  help popovers. Ancient-only selection and empty results are more explicit.
- Timeline and preset explanations clarify source estimates, shared dates and
  the limits of country-based archaeological comparisons.

### Fixed

- Country navigation keeps the opened country and comparison scope consistent.
  Searches, explicit collapses, language changes, returns and reloads retain
  their presentation state. Rapid typing defers repeated large-table renders.
- Selecting every available country behaves like clearing the local filter.
  Scoped counts and hidden descendant counts have accurate explanations.
- Out-of-range dates no longer stretch the timeline. Invalid scoped links are
  corrected with a notice, and revealing the final country batch keeps focus.
- Common-branch help now explains qualification at the upper branch of each
  connected same-Formed group; the calculation is unchanged.
- The independent semantic audit uses interval-local country minima and runs
  as part of the standard test command.

### Data

- Import metadata separates known, unknown and missing Formed values and counts
  disagreements between HRAS and YFull. The source-priority rule is unchanged.
  All 56 inputs matched the saved snapshot hashes on rebuild; topology, selected
  dates, sample counts and ancient classifications are unchanged. Only merge
  metadata and build/verification timestamps changed.

## 1.1.0 - 2026-10-25

### Changed

- Common-branch timeline bars now apply the country minimum to the unique sample
  pool of each chart interval. Moving the search date leaves fixed-grid bars
  unchanged, including on the logarithmic scale. Date-centered grids and steps
  linked to the search window can still change interval boundaries. Result rows
  use the exact search window; help popovers explain both scopes.
- Result details share the compact header, ancestry path, country controls and
  full-width matrix used by subclade exploration. Details retain the original
  result's countries and sample type, with additional information in disclosures.
- Subclade search now explains full identifiers and partial matches in English
  and Russian.

### Fixed

- Chart-only setting changes preserve the result table and reject stale chart
  responses during rapid updates.
- Country filters, selected-node summaries and country search stay consistent
  across details, subclade profiles and country comparisons.
- Expanded details and revealed rows survive language changes, navigation and
  reload; the original result remains available when returning from details.
- Matching parent-child age counts and their explanation remain accessible in
  the collapsed branch details, including supported nodes not yet revealed.

The bundled HRAS/YSEQ snapshot and its provenance are unchanged in this release.
