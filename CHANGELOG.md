# Changelog

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

The bundled HRAS/YSEQ snapshot and its provenance are unchanged in this release.
