import type { SampleScope } from "../shared/types";
import type { TextKey } from "./i18n";
import { escapeHtml } from "../shared/html";

export function readSampleScope(): SampleScope {
  const value = typeof location === "undefined" ? null : new URL(location.href).searchParams.get("samples");
  return value === "ancient" || value === "modern" ? value : "all";
}

export function bindSampleScope(): void {
  const selector = "#sample-scope, [data-sample-scope-control]";
  const select = document.querySelector<HTMLSelectElement>("#sample-scope");
  if (!select) return;
  let previousExportDisabled: boolean | undefined;
  const loadedScope = readSampleScope();
  select.value = loadedScope;
  window.addEventListener("pageshow", () => {
    if (readSampleScope() !== loadedScope) { location.reload(); return; }
    document.querySelectorAll<HTMLSelectElement>(selector).forEach(control => { control.value = loadedScope; control.disabled = false; });
    const exportButton = document.querySelector<HTMLButtonElement>("#export-csv");
    if (exportButton && previousExportDisabled !== undefined) exportButton.disabled = previousExportDisabled;
  });
  document.addEventListener("change", event => {
    const control = event.target as HTMLSelectElement;
    if (!control.matches(selector)) return;
    const url = new URL(location.href);
    url.searchParams.set("samples", control.value);
    const exportButton = document.querySelector<HTMLButtonElement>("#export-csv");
    if (exportButton) { previousExportDisabled = exportButton.disabled; exportButton.disabled = true; }
    document.querySelectorAll<HTMLSelectElement>(selector).forEach(item => { item.disabled = true; });
    // Full navigation rebuilds one coherent evidence scope for all workspaces.
    // Existing query and research-route URL fields remain intact.
    location.assign(url.href);
  });
}

export function ancientNote(count: number | undefined, t: (key: TextKey) => string, format: (n: number) => string): string {
  return count === undefined ? "" : `<small class="ancient-count-note">${escapeHtml(t("ancientSubset"))} ${escapeHtml(format(count))}</small>`;
}

export function selectedAncient(counts: Map<string, number> | undefined, countries: string[]): number | undefined {
  return counts ? countries.reduce((sum, code) => sum + (counts.get(code) ?? 0), 0) : undefined;
}
