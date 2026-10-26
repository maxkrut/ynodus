import assert from "node:assert/strict";

export function parseCsv(text) {
  if (!text) return [];
  const rows = [], row = [];
  let value = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (char === "," || char === "\n")) {
      row.push(value); value = "";
      if (char === "\n") { rows.push([...row]); row.length = 0; }
    } else value += char;
  }
  row.push(value); rows.push(row);
  const [header, ...body] = rows;
  return body.map((cells) => {
    assert.equal(cells.length, header.length);
    return Object.fromEntries(header.map((key, i) => [key, cells[i]]));
  });
}

export function checkCsv(api, query, actual, expected) {
  const text = api.resultsCsvText({ formedRows: actual.formed.rows, crossingRows: actual.crossing.rows,
    selectedCountries: query.selectedCountries, presenceMode: query.presenceMode,
    minResultSamples: query.minSamples, maxDeltaYbp: query.maxDeltaYbp, includeCrossing: true,
    targetYbp: query.target, targetYear: "synthetic", targetEra: "BCE", macroGroupFilter: null,
    formatCalendar: String, subcladeUrl: (id) => `https://example.invalid/${id}` });
  const rows = parseCsv(text), all = [...expected.formed, ...expected.crossing];
  assert.equal(rows.length, all.length, "CSV preserves number of primary rows");
  for (const row of rows) {
    const result = all.find((e) => e.id === row.result_identity.replaceAll(" > ", ">"));
    assert.ok(result, "CSV retains canonical identity");
    assert.equal(Number(row.total_selected), result.total);
    assert.deepEqual(row.path.split(" > "), result.path);
    assert.equal(Number(row.target_ybp), query.target);
    assert.equal(Number(row.max_delta_ybp), query.maxDeltaYbp);
    assert.equal(Number(row.min_result_samples), query.minSamples);
    assert.equal(row.min_samples_basis, query.presenceMode === "any" ? "not_applied_in_all_branches_mode"
      : query.minSamples === 0 ? "all_selected_countries_at_zero_minimum" : "per_selected_country_in_dataset_sample_scope");
    assert.deepEqual(JSON.parse(row.below_minimum_country_counts), Object.fromEntries(result.below));
    assert.equal(row.presence_mode, query.presenceMode);
    assert.match(row.calendar_basis_note, /source calendar epoch is not verified/);
    for (const country of query.selectedCountries) {
      assert.equal(Number(row[`count_${country}`]), result.counts.find(([c]) => c === country)?.[1] ?? 0);
    }
    if (row.result_mode === "formed") {
      assert.equal(Number(row.formed_branch_event_count), result.events.length);
      assert.deepEqual(row.formed_branch_members.split(" | ").sort(), result.events.flatMap((e) => e.members.map((m) => m.id)).sort());
      assert.deepEqual(row.formed_branch_event_support.split(" | ").sort(), result.events.map((e) => `${e.id}: ${e.total}`).sort());
      assert.equal(Number(row.formed_span_older_ybp), result.span.olderYbp);
      assert.equal(Number(row.formed_span_younger_ybp), result.span.youngerYbp);
    } else {
      assert.equal(row.crossing_child, result.child);
      assert.equal(row.source_date_anomaly, result.age < result.childAge ? "parent_formed_younger_than_child" : "");
    }
  }
}
