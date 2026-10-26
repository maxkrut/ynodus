# yNodus product contract

This is the authoritative behavior contract. Editorial changes must preserve these
invariants; behavior changes require explicit user approval. Implementation types
live in [src/shared/types.ts](src/shared/types.ts), not in a second copied schema.

## 1. Product boundary

yNodus explores aggregate Y-DNA evidence in a local HRAS/YSEQ snapshot, with an
independent YFull reference-tree marker. Its three entry points are time matches,
a named subclade profile, and a country overview. Time search is **matches-only**:
it answers which upper supported Formed branches match the selected countries and
date, plus optional real parent-to-child edges spanning that date. Profiles and
country overviews expose only their supported local hierarchy. There is no
unfiltered global tree browser, Passing, Poster, tree window, or SVG topology.
Current full topology belongs to the linked YFull pages.

Countries are publisher-recorded sample metadata, not ancestral residence,
ethnicity, nationality, exclusive lineage ownership, or migration routes. Counts
describe dataset coverage, not population frequency; absent records do not prove
historical absence. Explain these limits beside the relevant country/count/age
control rather than repeating a large generic disclaimer.

## 2. Evidence and country rules

- A fresh time-search entry has no selected countries or preset. Show the country
  selection prompt and keep results/export empty until the user chooses a scope.
  Explicit URL countries and restored navigation keep their chosen scope.
- All / Modern / Ancient is a shared sample scope, persisted as URL `samples`.
  Ancient records are matched to HRAS's separate ancient list during generation;
  only aggregate counts survive. Modern means unmarked in that list, not a tested
  sample age. Ancient country metadata describes discovery location; modern
  metadata describes reported paternal-line origin. Scope changes replace the
  consistent index/evidence view and immediately invalidate old export.
- The 33 presets contain country codes only. Manual selection and an identical
  preset use the same pipeline. Cultural/archaeological names are explicitly
  authored country-code proxies, not ancient-sample sets or cultural assignments.
- **All branches** (`any`) accepts positive support from any selected country and
  ignores the minimum. **Common branches** (`all`) at minimum 0 requires every
  selected country, including countries absent from the dataset or time window. An empty
  selection or required-country set gives no common results.
- At a positive minimum, determine participating countries from each selected
  country's unique sample count across the **entire dataset in the active sample
  scope**: all, ancient or modern. Include undated support. Count each aggregate
  record once; never sum ancestor totals. Date, window, bins, branch anchor and
  surviving matches do not change this set. Each canonical event or edge needs
  positive support from every participating country, without applying the threshold
  again. Formed, Crossing, density and nearest-date suggestions share this rule.
- Below-minimum countries remain selected. Positive counts remain in
  `countryCounts`, `total`, unique support and CSV; flags fade with contextual help.
  `belowMinimumCountryCounts` marks a subset, not extra samples. A country passing
  the dataset minimum stays active even with one sample in a row. Do not add countries
  outside the selection or countries absent from that row. All branches has no
  minimum-related fading or separate mixed-pool participation notice.
- If a nonempty Common selection has a positive minimum and no country qualifies
  across the active dataset scope, show a yellow explanation and **Show all branches** action.
  Do not automatically change mode, URL or rerun. A click submits the normal full
  query, preserving countries/date/window/minimum; the new mode ignores minimum.
  Pending clears the offer, locale changes translate it, and stale/error replies
  cannot create it. An empty selection or any qualifying country suppresses it.
- Sample totals are descendant-inclusive and non-additive across nested nodes or
  overlapping result rows. The main result count belongs to its upper event.
  Result tables name the active sample scope in their sample-column header; a
  restricted scope is highlighted. Standalone profiles avoid duplicate ancient
  subtitles; terminal details retain the ancient subset in All scope. CSV records
  `sample_scope` and `ancient_selected` for the same evidence as the main count.

## 3. Time and result sets

There is one target and an always-primary Formed set. Optional Crossing is a
separate secondary table. Both come from one committed Web Worker response.
Preserve raw source YBP. The application's approximate calendar convention uses
1950 CE and civil BCE/CE without year zero: 1 BCE = 1950 YBP, 1 CE = 1949 YBP.
[YFull's definition](https://www.yfull.com/faq/definitions/) excludes that
radiocarbon baseline; the export supplies no common reference/publication year.
Use one conversion for controls, window, labels, profiles, chart and CSV, and
record unknown source epochs plus the conditional display baseline in provenance.
Formed is a source estimate, not an exact mutation date or the focal node's TMRCA.

**Formed:** enumerate every supported node with known own `formed` and
`abs(formed - target) <= maxDeltaYbp`. Unknown transport dates or inherited display
labels cannot qualify. Connect equal source-age candidates only along real source
parent-child edges into canonical events. Unrelated equal dates stay separate.
An event's upper node carries its evidence; descendants do not add samples again.
Apply country participation to events, then connect surviving events into a branch
only across immediate source edges. Missing, unknown or filtered intermediates
break a branch. Its upper event supplies identity and primary counts; nested events
are detail. `formedSpan` and `deltaRange` cover all its events. Equal rounded source
estimates do not establish simultaneous mutations.

**Crossing:** a unique real dated `parent -> child` edge whose endpoint interval
contains the exact target. Window tolerance does not classify or widen it. Remove
edges whose parent or child is already a surviving Formed identity or same-age
member; excluded edges are not extra rows, counts or CSV records. Preserve inverted
source order (`parent.formed < child.formed`), mark it visibly and export
`source_date_anomaly=parent_formed_younger_than_child`; never swap or hide endpoints.

### 3.1. Subclade profile

The profile is non-temporal: no target, window, presence/minimum or timeline.
Its compact header contains identifier, hierarchy-derived macrogroup, source path,
source age, country flags/counts, sample scope and local search/filter/reset.
The upward action opens the immediate source parent; true roots have none.
**Search all branches near this estimate** changes only the time target, retains
time-search countries and never restricts the time query to this branch.

One full-width **Subclades × countries** matrix shows the complete supported
hierarchy, real depth and straight parent guides. The hierarchy column contains
identifiers and expansion/open controls only; ages/counts have their own columns.
Country headers have flags and vertical names; horizontal scrolling stays inside
the matrix. A standalone country header/chip or selector selects one country and
reveals supported chains with real ancestors; reset restores all in-scope countries.
Use at most 100 primary rows per page plus their ancestor context, reveal large
child groups 20 at a time, and search the full model. Preserve selected node,
inspector disclosure, filters, expansion, search and scroll across locale/history.
Clear inactive heavy DOM without losing recoverable presentation state.

Every node distinguishes direct assignments and descendant-inclusive totals;
direct assignments plus immediate-child totals partition its support. Count-cell
paint uses the light pastel ColorBrewer Blues scale, logarithmic to a common
whole-branch maximum, with unfilled zeros and readable text. It is independent of
macrogroup hues, page and local filter; expose the rule beside its legend.

### 3.1.1. Terminal time-result details

Result identifiers are plain text with separate **Details** and **YFull** actions.
Details is terminal and scoped to the row's sample type, positive countries and
evidence anchor: Formed root or Crossing child. Header total equals that row's
primary count, including retained below-minimum countries. Descendants and ancient
subsets are nested, not additional time matches. Local inspection and multi-country
filtering cannot expand the original evidence scope; reset restores only that scope.
Do not offer other profiles, country routes, broader country selection, time-search
actions, another-clade lookup or workspace tabs. Its only internal exit returns to
the time results. YFull endpoints remain explicit actions in the originating row.
Reload/history/locale retain detail scope; incomplete detail links fail closed to
time search and never become full profiles. Details does not replace the separately
saved standalone profile workspace. Reuse the standalone compact header, path,
country chips/selector/reset, local node search and clean full-width matrix. Sample
type is fixed to the originating result. Keep the selected-node inspector and
Formed event/member structure in disclosures, not separate permanent summary panels.

## 3.2. Country research

Branch-local country evidence starts with the originating country and immediate
supported level. Its independent multi-country scope accepts nodes supported by
any chosen country and retains real ancestors. Column filters apply immediately;
chooser drafts require **Apply**. Reset exposes all countries in that branch.
Show selected and all-country descendant totals separately, with direct counts
distinct. Child navigation retains scope; **All countries → profile** is explicit.
No local action changes the time query. Expansion, search and paging use the same
matrix and bounds as the profile.

A whole-snapshot country overview has its own URL and fixed primary country.
Comparison adds other countries' unique branches and preserves separate source
roots. The flag/search/preset picker retains the primary country; totals and
terminal macrogroup partitions use disjoint assignments. Sum of roots and sum of
terminal macrogroup partitions each equal the union total; direct plus immediate
children equals every node's total. Nested rows are never additive. Header-country
filtering narrows only this display; reset restores the union. Persist comparison
as research `scope`, separate from time countries, through locale/history/reload.

## 4. Result and density contracts

Research reading controls keep calculation and presentation separate:

- Density retains its default subclade count and adds an optional parent-group unit. A group is one known direct parent plus one exact source Formed value. Unrelated equal dates and different dates under one parent stay separate. Each unresolved parent is a singleton. This is a descriptive grouping, never a claim of independent dates or historical events. Parent mode colours the confirmed parent's hierarchy-derived macrogroup. Tooltips expose both counts, unresolved parents and the largest groups. Duration normalization applies to the selected unit; result rows, outlines and CSV still refer to underlying evidence.
- Country overviews initially show a compact terminal-assignment macrogroup summary, with disjoint counts. Selecting a group opens the real supported hierarchy from its first matching nodes. Each scope root discloses its actual immediate parent and a collapsible source-ancestry path. Ancestors inside a filtered profile remain context and retain full descendant-inclusive counts. Search covers the full scope when no macrogroup is selected. Comparison countries remain a union, including unique branches. All levels is an explicit opt-in to the paged full hierarchy.
- Profiles and terminal Details initially open the root and its immediate children. Deeper levels open on demand. Country and macrogroup filters, search, collapse, locale and history preserve scope and real edges. A macrogroup category is never a genealogical parent.

`TimeAnalysisResult` contains `formed: AnalysisResult` and optional `crossing`.
`ResultRow` includes `node`, optional `crossingChild`, real `path`, primary `total`,
`delta`, `countryCounts`, optional `sliceRelation` and below-minimum counts.
Formed has nonempty `formedEvents`, each with nonempty equal-date `formedMembers`,
their paths, nested counts, delta and `parentEventId`/`viaParentId`; row node/path/
members/counts repeat the upper event. Crossing's path ends with `node, crossingChild`.
Every adjacent path pair is a real source edge; null roots do not authorize links.
`AnalysisResult` also carries unique `matchingSamples`, `minSamples`, participating
countries, the optional minimum offer, neighbor suggestions and density cache key.
`densityRows: null` means the main thread already holds that exact key, not empty data.

Density is navigation context, never table/counter/CSV input. It uses the same
mandatory countries as Formed, derived from whole-dataset active-scope coverage.
Apply that set to canonical connected same-age groups; retain each included member,
its selected-country total and the mandatory countries for the tooltip. In the exact
search window, density member IDs equal the union of all Formed event members in
full results, in both directions, before table-only macrogroup filtering/pagination.
Table rows can group connected events. A chart interval can have different bounds
from the query window, so an entire bar need not equal the current table. Outlines
mark result members in their bins. No per-bin or per-window country exclusion.

Density keys include index provenance, sample scope, countries and presence.
Common keys also include minimum and, above zero, the actual interval boundaries.
With unchanged interval bounds, the selected date/window and Crossing option do not
affect density. Changing the window can change the bins when step sync is enabled.
All-branches density ignores minimum; strict zero and Any do not depend on binning.
Raw scope cache holds one scope; density cache is bounded to 16 keys / 100,000 rows
and invalidated when index/evidence scope changes. Chart-only interval requests run
in the Worker with latest-only commits, independently of table queries and export.

The shared axis is linear from 1950 CE to 10,000 BCE (11,949 YBP), logarithmic
earlier. Dates, periods, slider, window and bars use that same transformation.
All complete chart bins have equal screen width, including the selected bin;
log-bin durations grow toward older dates. Search remains exactly target ± window
and is drawn separately, not as a special central bin. Shared boundaries belong
only to the right bin, with the scale endpoint included in the final bin.

Chart interval defaults to 300 linear years on every width. Whole-timeline grid is
anchored at 10,000 BCE; date-centered grid centers the selected date in shared
axis coordinates and moves the entire grid. **Use window for step** sets interval
to twice the window (±300 → 600); log bins need not coincide with the search window.
Disabling sync restores manual step. Persist settings locally; interval changes may
request chart-only aggregation but never reclassify tables/CSV. Explain zero synced window or an excessively fine
grid instead of drawing it; cap bins at 8192. Tooltips begin with bounds, actual
YBP duration and scale segment, then counts/composition.

Bar height is subclade count by default, or `count / binDurationYbp * 1000` in
**Per 1,000 years**, including clipped/mixed bins. Keep raw full-scale total;
round short normalized labels to tenths, use `<0.1` for smaller positive values,
give nonzero fills at least 1 px and no fill to zeros. This measures concentration
of source estimates, not a demographic or mutation-rate surge. No cumulative
sample chart or Worker payload exists. Connected same-age relatives may share a
visual layer. Fixed classic ggplot2 hue colors, labels below bars and row colors
share the hierarchy-derived `macroGroup`; preserve source `project`. Use the
closest supported named ancestor without crossing null roots or guessing.

One outline covers current Formed intervals. Clicking a nonempty bar, Enter or
Space selects its stated source estimate and updates target, slider, URL and
results; composition remains in help/accessible description. Neighbor buttons
search earlier/later source dates with real Formed matches under the same scope,
presence, minimum and window, retaining the same dataset-based mandatory countries. Skip empty
candidates, omit unavailable directions and never relax minimum. Use a bounded
supported-date/evidence sweep, not a full query per candidate.

## 5. Interface, navigation and export

Wide-screen filter groups form one compact row with subtle vertical separators;
countries have the widest group. Keep date and window together during reflow and
step sync below the interval. Full epoch names in EN/RU use thin bracket bands,
hatched transitions and self-hosted type. Keep every label horizontal and readable.
Use up to two lines inside a band where it fits; otherwise use nonoverlapping
horizontal callouts with leader lines, preserving calendar widths. Reflow after
font loading, locale and width changes. Interval composition appears after one
second of pointer hover, closes on bar activation or pointer exit from the bar
and tooltip, and remains accessible through keyboard focus.
Do not replace results with redundant large sample/row/result metric tiles.
At 390 px, result heading/summary precedes secondary timeline context. Supported
widths have no document-level horizontal overflow or overlapping controls; focus
and hover must not change geometry. Mobile recovery, country disclosure/remove/
bulk actions, dialog close and profile/evidence controls have ≥44 px hit areas.
Country preview retains its total and compact expansion; at 10+ countries the
dialog preview shows three items plus **Show more N**, contained inside its scroll
region. Country and preset lists scroll independently with fixed dialog chrome.

English is the default. A saved manual EN/RU choice takes precedence over URL
`lang`; without it, honor a valid link language, otherwise use English. Navigation
and browser history preserve the active language. Switching works without browser
storage and requires no geolocation, cookies or analytics requests.

Contextual Back names and restores the entry destination, not necessarily the
genealogical parent: lookup, prior profile, time row, country branch or overview.
Direct links fall back locally; empty lookup/choice screens have no Back action.
Tabs retain each workspace's own entity/origin; native Back/Forward remains
chronological. Restore drafts/options, query/results, both table filters/sorts,
reveals, scroll and opener focus without unnecessary analysis. Reload retains the
same history-entry context. Later restoration cannot steal newer navigation focus.
URL/history contain public identifiers/settings only, not sample identities,
result payloads or a promise to pin a historical index. Invalid/retired URL settings
are corrected explicitly. BCE/CE retain separate valid drafts. Blank numeric fields
invalidate old output and restore the last valid value on blur.

Each table initially shows 50 rows and reveals 50 more. Sorting is global, not
regrouped by macrogroup. Formed/Crossing macrogroup selectors are independent,
contain only their own full result's groups, hide when redundant, and affect only
their table/CSV. Show filtered/full counts; reset only a vanished selection.
Locale/returns preserve both filters; pending disables them. CSV includes both
complete filtered sets regardless of disclosure, with `macrogroup_filter` and
`macrogroup`, primary identity/counts, all Formed event/member paths/links/nested
counts, spans/deltas, both Crossing endpoints/anomalies, sample scope, countries,
window, presence/minimum, Crossing option and committed source/app provenance.
Escape formula-like cells. `min_samples_basis` is
`all_selected_countries_at_zero_minimum`,
`per_selected_country_in_dataset_sample_scope`, or
`not_applied_in_all_branches_mode`; `below_minimum_country_counts` is a subset.

## 6. Pending and consistency

Run heavy aggregation in the Worker, keeping only the newest unstarted query.
Real query/scope/source changes enter `pending` immediately, block export (also
inside its handler via `analysisBusy`) and accept only the latest reply. Never
mix old rows with new metadata. Research requests obey the same latest-only rule.
Loading, pending, ready, empty and error are visible, localized and announced.
Locale rerenders the current phase rather than reviving old rows.

During slider drag or changed Formed queries, retain dimmed previous bars with an
explicit previous-query label, remove old outlines, disable clicks/focus and move
slider/window; analyze after release and update current bars/outlines together.
Errors clear old chart data; stale replies cannot commit. Crossing-only changes
keep unchanged committed Formed bars/outlines/brightness ready while tables/CSV
wait for the joint reply. That exception excludes drafts or changes to countries,
date, window, presence, minimum, scope or index. Identical completed parameters
do not queue or enter pending; local sort/filter/picker search/help must not
recreate chart bars. No separate Calculate button is required for valid queries.

## 7. Data and privacy

The browser reads `public/data/hras-index.json`; update it only through the
canonical generator. Preserve independent HRAS snapshot and YFull reference
versions/dates, never infer synchronization from equality. Count only HRAS/YSEQ
records with country metadata. Names, kit/sample identifiers, individual profiles
and private results must not enter the runtime index, UI, fixtures, logs, images
or other artifacts. See [DEVELOPMENT.md](DEVELOPMENT.md) for generation and
compatibility procedures and [NOTICE.md](NOTICE.md) for source attribution.

## 8. Acceptance registry

These stable IDs retain the acceptance coverage of the original contract.
Verify applicable clauses, not merely the presence of matching text.

| ID | Required check |
|---|---|
| 1 | All 33 presets are country-code proxies using the common pipeline. |
| 2 | Equivalent manual/preset countries give identical results. |
| 3 | Formed candidate → equal-age event → country filter → real-edge branch order. |
| 4 | Nonempty events/members, real paths, upper-event counts and full spans/deltas. |
| 5 | Unique uncovered Crossing edges, correct path ending, preserved date anomalies. |
| 6 | Unique aggregate evidence and non-additive nested event totals. |
| 7 | Unique matching support, retained below-minimum counts and explicit CSV basis. |
| 8 | Time search has no hidden branch restriction. |
| 9 | Always-primary Formed and optional separate Crossing share one committed query. |
| 10 | Complete, formula-safe CSV with event/member structure and both edge endpoints. |
| 11 | Secondary density, shared dataset-scope country rule and bidirectional exact-window member parity, equal screen bins, valid Formed outline and direct bar activation. |
| 12 | Immediate export invalidation and rejection of stale replies. |
| 13 | No mixing old CSV rows with new provenance/query metadata. |
| 14 | Visible/announced states survive locale changes. |
| 15 | Local sorting/reveal and stable keyboard focus without analysis. |
| 16 | Supported profile matrix, bounded rows, real ancestors and immediate-parent action. |
| 17 | Explicit YFull actions and independent source ledger without sync claims. |
| 18 | 33 × Formed/Crossing × Any/Every = 132 semantic cases; exhaustive dates/windows available. |
| 19 | Non-temporal profile has no time controls or implicit time analysis. |
| 20 | Direct and subtree counts remain distinct and non-additive. |
| 21 | Branch-country scope, initial level, totals and preserved independent selection. |
| 22 | Contextual metadata, population-frequency and absence limitations. |
| 23 | No exact-mutation/TMRCA or simultaneous-mutation claims from Formed. |
| 24 | Contextual/tab/native return state; only explicit age-search action changes time target. |
| 25 | Independent table-only macrogroup filters, counters and CSV parity. |
| 26 | Explicit minimum-recovery action, never automatic mode/URL fallback. |
| 27 | No page overflow, control collisions or focus/hover geometry shifts. |
| 28 | Mobile hit areas remain ≥44 px without dominant full-width utility actions. |
| 29 | Bounded country preview/expansion and persistent selection total. |
| 30 | Mobile result heading/summary precedes secondary timeline context. |
| 31 | EN/RU coverage at representative widths and responsive boundaries. |
| 32 | Validated public URLs/history; no sample IDs, results or false snapshot pinning. |
| 33 | Blank drafts and held slider invalidate output while retaining clear context. |
| 34 | Committed CSV provenance and explicitly conditional calendar baseline. |
| 35 | Nearest qualifying dates under the unchanged query, with an efficient evidence sweep. |
| 36 | Separate valid BCE/CE drafts survive era switching. |
| 37 | Independent country/preset scroll regions and explicit source-count labels. |
| 38 | Whole-country comparison union, real roots, disjoint partitions and local matrix filters. |
| 39 | Clear inactive heavy DOM; restore state without stale replies or focus theft. |
| 40 | Persistent chart-only step/grid/sync, exact search window and unique bin ownership. |
| 41 | No separate mixed-pool notice; retain country rules, faded flags and explicit recovery. |
| 42 | Compact filter grouping, adjacent date/window and no cumulative sample chart. |
| 43 | Terminal scoped details reuse the compact profile header/matrix; scope, returns and standalone workspace remain independent. |
| 44 | Persistent duration-normalized density with valid labels, fills and interpretation. |
| 45 | Strict zero minimum, including missing countries, neighbors and 0 → 1 → 0 cache isolation. |
