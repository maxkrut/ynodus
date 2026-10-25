import type { PresenceMode, ResultRow, SliceMode } from "../shared/types";
import { csvCell } from "./format";
import { nodeMacroGroup } from "../shared/haplogroups";
import { YBP_BASE_YEAR } from "../shared/time";
import { APP_VERSION } from "./constants";
import type { QueryProvenance } from "./state";

type ResultsCsvInput = {
  formedRows: ResultRow[];
  crossingRows: ResultRow[];
  selectedCountries: string[];
  presenceMode: PresenceMode;
  minResultSamples?: number;
  maxDeltaYbp?: number;
  includeCrossing?: boolean;
  provenance?: QueryProvenance;
  targetYbp: number;
  targetYear: string;
  targetEra: string;
  macroGroupFilter: string | null;
  crossingMacroGroupFilter?: string | null;
  formatCalendar: (ybp: number) => string;
  subcladeUrl: (id: string) => string;
};

export function downloadResultsCsv(input: ResultsCsvInput): void {
  const csvText = resultsCsvText(input);
  if (!csvText) return;

  const blob = new Blob([csvText], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ynodus-${input.targetYear}-${input.targetEra}.csv`;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  window.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 0);
}

export function resultsCsvText(input: ResultsCsvInput): string {
  const resultSets: Array<{ rows: ResultRow[]; sliceMode: SliceMode }> = [
    {
      rows: input.formedRows,
      sliceMode: "formed",
    },
    {
      rows: input.crossingRows,
      sliceMode: "crossing",
    },
  ];
  if (resultSets.every((set) => set.rows.length === 0)) return "";
  const selectedCountries = [...input.selectedCountries].sort();
  const header = [
    "presence_mode",
    "result_mode",
    "min_result_samples",
    "target_ybp",
    "target_calendar",
    "macrogroup_filter",
    "slice_relation",
    "macrogroup",
    "result_identity",
    "formed_group_size",
    "formed_group_members",
    "formed_group_paths",
    "formed_group_urls",
    "formed_branch_event_count",
    "formed_branch_subclade_count",
    "formed_branch_events",
    "formed_branch_event_support",
    "formed_branch_members",
    "formed_branch_paths",
    "formed_branch_urls",
    "formed_span_older_ybp",
    "formed_span_older_calendar",
    "formed_span_younger_ybp",
    "formed_span_younger_calendar",
    "delta_min_ybp",
    "delta_max_ybp",
    "subclade",
    "crossing_child",
    "path",
    "subclade_formed_ybp",
    "subclade_formed_calendar",
    "crossing_child_formed_ybp",
    "crossing_child_formed_calendar",
    "source_date_anomaly",
    "delta_ybp",
    "total_selected",
    ...selectedCountries.map((code) => `count_${code}`),
    "subclade_url",
    "crossing_child_url",
    "max_delta_ybp", "include_crossing", "selected_countries",
    "hras_snapshot_version", "hras_computed_date", "yfull_reference_version",
    "index_generated_at", "runtime_format", "hras_source_url", "hras_manifest_url",
    "application_version", "calendar_base_year", "calendar_basis_note", "min_samples_basis", "below_minimum_country_counts", "sample_scope", "ancient_selected",
  ];

  const lines = resultSets.flatMap(({ rows, sliceMode }) => rows.map((row) => {
    const formedMembers = sliceMode === "formed"
      ? row.formedMembers ?? [{ node: row.node, path: row.path }]
      : [];
    const formedEvents = sliceMode === "formed"
      ? row.formedEvents ?? [{
          node: row.node,
          path: row.path,
          formedMembers,
          total: row.total,
          delta: row.delta,
          countryCounts: row.countryCounts,
          parentEventId: null,
          viaParentId: null,
        }]
      : [];
    const branchMembers = formedEvents.flatMap((event) => event.formedMembers);
    const formedSpan = row.formedSpan ?? (formedEvents.length > 0 ? {
      olderYbp: Math.max(...formedEvents.map((event) => event.node.formed)),
      youngerYbp: Math.min(...formedEvents.map((event) => event.node.formed)),
    } : null);
    const deltaRange = row.deltaRange ?? (formedEvents.length > 0 ? {
      minYbp: Math.min(...formedEvents.map((event) => event.delta)),
      maxYbp: Math.max(...formedEvents.map((event) => event.delta)),
    } : null);
    const values = [
      input.presenceMode,
      sliceMode,
      String(input.minResultSamples ?? 0),
      String(input.targetYbp),
      input.formatCalendar(input.targetYbp),
      (sliceMode === "crossing" ? input.crossingMacroGroupFilter : input.macroGroupFilter) ?? "",
      row.sliceRelation ?? "",
      nodeMacroGroup(row.node),
          sliceMode === "crossing" && row.crossingChild
        ? `${row.node.id} > ${row.crossingChild.id}`
        : row.node.id,
      formedMembers.length > 0 ? String(formedMembers.length) : "",
      formedMembers.map((member) => member.node.id).join(" | "),
      formedMembers
        .map((member) => `${member.node.id}: ${member.path.map((node) => node.id).join(" > ")}`)
        .join(" | "),
      formedMembers.map((member) => input.subcladeUrl(member.node.id)).join(" | "),
      formedEvents.length > 0 ? String(formedEvents.length) : "",
      branchMembers.length > 0 ? String(branchMembers.length) : "",
      formedEvents
        .map((event) => `${event.node.id}@${event.node.formed}`)
        .join(" | "),
      formedEvents
        .map((event) => `${event.node.id}: ${event.total}`)
        .join(" | "),
      branchMembers.map((member) => member.node.id).join(" | "),
      branchMembers
        .map((member) => `${member.node.id}: ${member.path.map((node) => node.id).join(" > ")}`)
        .join(" | "),
      branchMembers.map((member) => input.subcladeUrl(member.node.id)).join(" | "),
      formedSpan ? String(formedSpan.olderYbp) : "",
      formedSpan ? input.formatCalendar(formedSpan.olderYbp) : "",
      formedSpan ? String(formedSpan.youngerYbp) : "",
      formedSpan ? input.formatCalendar(formedSpan.youngerYbp) : "",
      deltaRange ? String(deltaRange.minYbp) : "",
      deltaRange ? String(deltaRange.maxYbp) : "",
      row.node.id,
      row.crossingChild?.id ?? "",
      resultPath(row),
      String(row.node.formed),
      input.formatCalendar(row.node.formed),
      row.crossingChild ? String(row.crossingChild.formed) : "",
      row.crossingChild ? input.formatCalendar(row.crossingChild.formed) : "",
      row.crossingChild && row.node.formed < row.crossingChild.formed
        ? "parent_formed_younger_than_child"
        : "",
      sliceMode === "crossing" ? "" : String(row.delta),
      String(row.total),
      ...selectedCountries.map((code) => String(row.countryCounts.get(code) ?? 0)),
      input.subcladeUrl(row.node.id),
      row.crossingChild ? input.subcladeUrl(row.crossingChild.id) : "",
      input.maxDeltaYbp === undefined ? "" : String(input.maxDeltaYbp),
      String(input.includeCrossing ?? input.crossingRows.length > 0),
      selectedCountries.join(" | "),
      input.provenance?.version ?? "", input.provenance?.computedDate ?? "",
      input.provenance?.officialVersion ?? "", input.provenance?.generatedAt ?? "",
      input.provenance?.format ?? "", input.provenance?.sourceUrl ?? "",
      input.provenance?.sourceManifestUrl ?? "", APP_VERSION, String(YBP_BASE_YEAR),
      "yNodus display convention (1950 baseline; civil BCE/CE with no year zero); source calendar epoch is not verified for this export; YFull ybp is not a 1950 epoch: https://www.yfull.com/faq/definitions/",
      input.presenceMode === "any" ? "not_applied_in_all_branches_mode"
        : (input.minResultSamples ?? 0) === 0 ? "all_selected_countries_at_zero_minimum" : "per_selected_country_in_temporal_candidate_pool",
      JSON.stringify(Object.fromEntries(row.belowMinimumCountryCounts ?? [])),
      input.provenance?.sampleScope ?? "all",
      row.ancientTotal === undefined ? (input.provenance?.sampleScope === "ancient" ? String(row.total) : input.provenance?.sampleScope === "modern" ? "0" : "") : String(row.ancientTotal),
    ];
    return values.map(csvCell).join(",");
  }));

  return [header.join(","), ...lines].join("\n");
}

function resultPath(row: ResultRow): string {
  return row.path.map((node) => node.id).join(" > ");
}
