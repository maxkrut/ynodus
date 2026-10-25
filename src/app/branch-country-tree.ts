import { escapeHtml as h } from "../shared/html";
import type { SubcladeProfile } from "../shared/types";
import type { TextKey } from "./i18n";
import { renderBranchCountrySidebar } from "./branch-country-sidebar";
import { renderBranchCountryMatrix } from "./branch-country-matrix";
import { MATRIX_ROWS } from "./profile-matrix";
import { bindEvidenceTreeKeys } from "./evidence-tree-table";
import { deferredResearchRender } from "./research-display-state";

export type BranchTreeState = { anchor: string; query: string; searchClosed?: string[]; opened: string[]; limits: Array<[string, number]>; offset?: number; treeScrollLeft?: number };
type Options = {
  root: HTMLElement; t: (key: TextKey) => string;
  formatNumber: (value: number) => string; formatCalendar: (value: number) => string;
  countryName: (code: string) => string; countryFlag: (code: string) => string;
  onCountries: (countries: string[]) => void; onChange: () => void;
};

/** One supported hierarchy, with shared expansion and independent country filtering. */
export function createBranchCountryTree({ root, t, formatNumber: n, formatCalendar, countryName, countryFlag, onCountries, onChange }: Options) {
  let profile: SubcladeProfile | null = null;
  let countries: string[] = [], draft = new Set<string>(), query = "";
  let offset = 0;
  let treeScrollLeft = 0;
  const opened = new Set<string>(), limits = new Map<string, number>();
  const searchClosed = new Set<string>(), deferred = deferredResearchRender(renderBody);
  const display = { t, formatNumber: n, formatCalendar, countryName, countryFlag };
  bindEvidenceTreeKeys(root);
  root.addEventListener("scroll", event => { const target = event.target; if (target instanceof HTMLElement && target.matches(".tree-sheet-scroll")) { treeScrollLeft = target.scrollLeft; onChange(); } }, { capture: true, passive: true });
  window.addEventListener("click", event => { const drawer = root.querySelector<HTMLDetailsElement>(".branch-country-filter-drawer[open]"); if (drawer && !drawer.contains(event.target as Node)) drawer.open = false; });
  root.addEventListener("keydown", event => { if (event.key !== "Escape") return; const drawer = root.querySelector<HTMLDetailsElement>(".branch-country-filter-drawer[open]"); if (drawer) { drawer.open = false; drawer.querySelector<HTMLElement>("summary")?.focus(); } });
  root.addEventListener("input", event => {
    const input = event.target as HTMLInputElement;
    if (input.matches("[data-branch-tree-search]")) { query = input.value; searchClosed.clear(); offset = 0; deferred.schedule(); onChange(); }
    if (input.matches("[data-branch-country-search]")) {
      const needle = input.value.trim().toLocaleLowerCase();
      root.querySelectorAll<HTMLElement>("[data-branch-country-option]").forEach(row => { row.hidden = !row.dataset.branchCountryOption!.includes(needle); });
    }
  });
  root.addEventListener("change", event => {
    const input = event.target as HTMLInputElement;
    if (!input.matches("[data-branch-country-choice]")) return;
    if (input.checked) draft.add(input.value); else draft.delete(input.value);
    const changed = draft.size !== countries.length || countries.some(code => !draft.has(code));
    const apply = root.querySelector<HTMLButtonElement>("[data-branch-country-apply]");
    if (apply) apply.disabled = draft.size === 0 || !changed;
    const warning = root.querySelector<HTMLElement>("[data-branch-country-required]");
    if (warning) warning.hidden = draft.size !== 0;
    const pending = root.querySelector<HTMLElement>("[data-branch-country-pending]");
    if (pending) pending.hidden = !changed || !draft.size;
  });
  root.addEventListener("click", event => {
    if (!profile) return;
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-branch-country-apply], [data-evidence-tree-toggle], [data-evidence-tree-more], [data-evidence-tree-page], [data-tree-country], [data-tree-country-reset]");
    if (!button) return;
    if (button.hasAttribute("data-branch-country-apply")) { if (draft.size) { offset = 0; onCountries([...draft]); } return; }
    if (button.dataset.treeCountry || button.hasAttribute("data-tree-country-reset")) {
      const all = [...profile.countryCounts.keys()];
      const next = new Set(all.every(code => countries.includes(code)) ? [] : countries);
      const code = button.dataset.treeCountry;
      if (code) { if (next.has(code)) next.delete(code); else next.add(code); }
      else next.clear();
      offset = 0;
      const selected = next.size ? [...next] : all, current = profile;
      render(current, selected); onCountries(selected); return;
    }
    const id = button.dataset.evidenceTreeToggle;
    if (id) { const toggles = query.trim() ? searchClosed : opened; if (toggles.has(id)) toggles.delete(id); else toggles.add(id); }
    const more = button.dataset.evidenceTreeMore;
    if (more) limits.set(more, (limits.get(more) ?? 20) + 20);
    if (button.dataset.evidenceTreePage) offset = Math.max(0, offset + (button.dataset.evidenceTreePage === "next" ? MATRIX_ROWS : -MATRIX_ROWS));
    renderBody();
    if (button.dataset.evidenceTreePage) {
      const pane = root.querySelector<HTMLElement>(".tree-sheet-scroll"), first = pane?.querySelector<HTMLElement>("tbody tr:not(.tree-context-row)");
      if (pane && first) pane.scrollTop = Math.max(0, first.offsetTop - (pane.querySelector<HTMLElement>("thead")?.offsetHeight ?? 0));
    }
    const selector = id ? `[data-evidence-tree-toggle="${CSS.escape(id)}"]` : more ? `[data-evidence-tree-more="${CSS.escape(more)}"]` : ".profile-matrix-scroll";
    if (!button.isConnected) root.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
    onChange();
  });

  function render(value: SubcladeProfile | null, selected: string[]): void {
    deferred.cancel();
    const container = root.querySelector<HTMLElement>("[data-branch-country-tree]");
    if (!value || !container) return;
    if (profile?.node.id !== value.node.id) { query = ""; searchClosed.clear(); offset = 0; treeScrollLeft = 0; opened.clear(); limits.clear(); opened.add(value.node.id); }
    profile = value; countries = [...selected]; draft = new Set(countries);
    container.innerHTML = `<div class="branch-country-main">
      <div class="branch-country-toolbar">
      <label class="country-tree-search">${h(t("countryTreeSearch"))}<input id="branch-tree-search" type="search" data-branch-tree-search value="${h(query)}" autocomplete="off" spellcheck="false" aria-controls="branch-tree-body"></label>
      <details class="branch-country-filter-drawer"><summary>${h(t("branchCountries"))} · ${n(countries.length)}</summary>${renderBranchCountrySidebar(value, countries, display)}</details></div>
      <div id="branch-tree-body" data-branch-tree-body></div></div>`;
    renderBody();
  }
  function renderBody(): void {
    deferred.cancel();
    const body = root.querySelector<HTMLElement>("[data-branch-tree-body]");
    if (!body || !profile) return;
    body.innerHTML = renderBranchCountryMatrix(profile, countries, MATRIX_ROWS, offset, display,
      { opened: [...opened], limits: [...limits], query, searchClosed: [...searchClosed] });
    const pane = body.querySelector<HTMLElement>(".tree-sheet-scroll");
    if (pane) { pane.scrollLeft = treeScrollLeft; offset = Number(pane.dataset.treeOffset); }
  }
  function capture(): BranchTreeState | undefined { return profile ? { anchor: profile.node.id, query, searchClosed: [...searchClosed], opened: [...opened], limits: [...limits], offset, treeScrollLeft } : undefined; }
  function restore(saved?: BranchTreeState): void {
    if (!saved || saved.anchor !== profile?.node.id) return;
    query = saved.query; offset = saved.offset ?? 0; treeScrollLeft = saved.treeScrollLeft ?? 0;
    searchClosed.clear(); saved.searchClosed?.forEach(id => searchClosed.add(id));
    opened.clear(); limits.clear(); saved.opened.forEach(id => opened.add(id)); saved.limits.forEach(([id, limit]) => limits.set(id, limit));
  }
  return { render, capture, restore };
}
