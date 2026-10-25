import type { EvidenceTreeNode, SubcladeProfile } from "../shared/types";
import { MATRIX_ROWS, renderProfileMatrix, type ProfileMatrixOptions } from "./profile-matrix";
import { bindEvidenceTreeKeys } from "./evidence-tree-table";
import { ancientNote, selectedAncient } from "./sample-scope";
import { compactTreeOpened, toggleResearchNode } from "./research-tree-reading";
import { nodeMacroGroup } from "../shared/haplogroups";
import { activeCountryFilter, deferredResearchRender, restoreCountrySearch } from "./research-display-state";

export type ProfileExplorerState = {
  anchor: string; selected: string; rows: number; offset: number; countryScroll?: number; countriesOpen?: boolean;
  countries?: string[]; closed?: string[]; limits?: Array<[string, number]>; query?: string; treeScrollLeft?: number; inspectorOpen?: boolean;
  extrasOpen?: string[];
  macro?: string;
  opened?: string[];
  searchClosed?: string[]; countrySearch?: string;
};
type Options = ProfileMatrixOptions & {
  root: HTMLElement;
  inspector: (node: EvidenceTreeNode, isRoot: boolean) => string;
  onChange: () => void;
};

/** Selection is local presentation state; it never changes the time query or profile route. */
export function createProfileExplorer(o: Options) {
  bindEvidenceTreeKeys(o.root);
  let profile: SubcladeProfile | null = null;
  let state: ProfileExplorerState | undefined;
  const nodes = new Map<string, EvidenceTreeNode>();
  const element = (selector: string) => o.root.querySelector<HTMLElement>(selector);
  const inspector = () => {
    const selected = state && nodes.get(state.selected);
    const host = element("[data-profile-inspector]");
    if (host) host.innerHTML = selected ? o.inspector(selected, selected.node.id === profile?.node.id) : "";
    const disclosure = element("[data-profile-inspector-disclosure]") as HTMLDetailsElement | null;
    if (disclosure) { disclosure.hidden = !selected; disclosure.open = !!selected && state?.inspectorOpen === true; }
    const countries = element("[data-profile-countries]") as HTMLDetailsElement | null;
    if (countries) countries.open = state?.countriesOpen === true;
    const list = element('[data-evidence-list="profile-countries"]');
    if (list) list.scrollTop = state?.countryScroll ?? 0;
    restoreCountrySearch(o.root, state?.countrySearch);
    o.root.querySelectorAll<HTMLElement>("[data-profile-select]").forEach(button => {
      const active = button.dataset.profileSelect === state?.selected;
      button.setAttribute("aria-pressed",String(active));
      button.closest(".evidence-tree-node")?.classList.toggle("is-selected",active);
    });
  };
  o.root.addEventListener("toggle", event => {
    const details = event.target;
    if (!state || !(details instanceof HTMLDetailsElement)) return;
    if (details.dataset.profileExtra) {
      const open = new Set(state.extrasOpen), key = details.dataset.profileExtra;
      if (open.has(key) !== details.open) {
        if (details.open) open.add(key); else open.delete(key);
        state.extrasOpen = [...open]; o.onChange();
      }
      return;
    }
    if (details.matches("[data-profile-inspector-disclosure]")) { if (state.inspectorOpen !== details.open) { state.inspectorOpen = details.open; o.onChange(); } return; }
    if (!details.matches("[data-profile-countries]")) return;
    if (state.countriesOpen !== details.open) { state.countriesOpen = details.open; o.onChange(); }
  }, true);
  const renderTable = () => {
    deferred.cancel();
    if (!state || !profile) return;
    const tree = element("[data-profile-tree-table]");
    if (tree) tree.innerHTML = renderProfileMatrix(profile, state.rows, state.offset, o, state);
    const pane = element(".tree-sheet-scroll");
    if (pane) { pane.scrollLeft = state.treeScrollLeft ?? 0; state.offset = Number(pane.dataset.treeOffset); }
    const summary = element("[data-profile-inspector]");
    if (summary) summary.hidden = false;
    const countries = activeCountryFilter(state.countries, profile.countryCounts);
    const macro = element("[data-research-macro]") as HTMLSelectElement | null;
    if (macro) macro.value = state.macro ?? "";
    const select = element("[data-profile-country-filter]") as HTMLSelectElement | null;
    if (select) {
      select.querySelector('[data-profile-multiple-countries]')?.remove();
      if (countries.length > 1 && countries.length < profile.countryCounts.size) {
        const option = new Option(`${o.t("selectedCountries")}: ${o.formatNumber(countries.length)}`, "multiple");
        option.disabled = true; option.dataset.profileMultipleCountries = "";
        select.add(option); select.value = option.value;
      } else select.value = countries.length === 1 ? countries[0] : "";
    }
    o.root.querySelectorAll<HTMLButtonElement>(".profile-country-chip").forEach(button => button.setAttribute("aria-pressed",String(countries.includes(button.dataset.profileCountry!))));
    const reset = element(".profile-country-reset") as HTMLButtonElement | null;
    if (reset) reset.disabled = !countries.length;
    const total = element("[data-profile-scope-total]"), label = element("[data-profile-total-label]");
    if (total) total.textContent = o.formatNumber(countries.length ? countries.reduce((sum,code) => sum+(profile!.countryCounts.get(code)??0),0) : profile.total);
    const ancient = element("[data-profile-scope-ancient]");
    if (ancient) ancient.innerHTML = ancientNote(countries.length ? selectedAncient(profile.ancientCountryCounts, countries) : profile.ancientTotal, o.t, o.formatNumber);
    if (label) label.textContent = o.t(countries.length ? "branchCountriesSelectedColumn" : "profileSubtreeEvidence");
  };
  const deferred = deferredResearchRender(renderTable);
  const selectCountry = (code: string) => {
    if (!state || !profile) return;
    state.countries = code && profile.countryCounts.has(code) ? [code] : [];
    state.offset = 0;
    reconcileSelection();
  };
  const reconcileSelection = (retainContext = false) => {
    if (!state || !profile) return;
    const supports = (node: EvidenceTreeNode) => (!state!.macro || nodeMacroGroup(node.node) === state!.macro)
      && (!state!.countries?.length || state!.countries.some(code => (node.countryCounts.get(code) ?? 0) > 0));
    const node = nodes.get(state.selected);
    // An explicitly inspected context ancestor remains meaningful on locale/history render.
    if (retainContext && node && state.macro) {
      const pending = [...node.children];
      while (pending.length) { const child = pending.pop()!; if (supports(child)) return; pending.push(...child.children); }
    }
    if (!node || !supports(node)) {
      state.selected = [...nodes.values()].find(supports)?.node.id ?? "";
      state.inspectorOpen = false; state.countriesOpen = false; state.countryScroll = 0; inspector();
    }
  };
  o.root.addEventListener("change", event => {
    const select = event.target as HTMLSelectElement;
    if (state && profile && select.matches("[data-research-macro]")) {
      state.macro = select.value; state.offset = 0; state.opened = compactTreeOpened([profile.evidenceTree], state.macro);
      reconcileSelection(); renderTable(); o.onChange(); return;
    }
    if (!state || !select.matches("[data-profile-country-filter]")) return;
    selectCountry(select.value); renderTable(); o.onChange();
  });
  o.root.addEventListener("input", event => {
    const input = event.target as HTMLInputElement;
    if (state && input.matches("[data-profile-country-search]")) {
      if (state.countrySearch !== input.value) { state.countrySearch = input.value; o.onChange(); }
      return;
    }
    if (!state || !input.matches("[data-profile-tree-search]")) return;
    state.query = input.value; state.searchClosed = []; state.offset = 0; deferred.schedule(); o.onChange();
  });
  o.root.addEventListener("scroll", event => {
    const list = event.target;
    if (state && list instanceof HTMLElement && list.matches(".tree-sheet-scroll")) { state.treeScrollLeft = list.scrollLeft; o.onChange(); return; }
    if (!state || !(list instanceof HTMLElement) || !list.matches('[data-evidence-list="profile-countries"]')
      || element("[data-profile-tree-view]")?.hidden) return;
    const position = Math.round(list.scrollTop);
    if (state.countryScroll !== position) {
      state.countryScroll = position;
      o.onChange();
    }
  }, { capture: true, passive: true });
  o.root.addEventListener("click", event => {
    if (!profile || !state) return;
    if ((event.target as HTMLElement).closest("[data-research-expand]")) {
      state.opened = undefined; state.closed = []; state.searchClosed = []; state.offset = 0; renderTable(); o.onChange(); return;
    }
    if ((event.target as HTMLElement).closest("[data-research-collapse]")) {
      state.query = ""; state.offset = 0; state.limits = []; state.opened = compactTreeOpened([profile.evidenceTree], state.macro);
      const search = element("[data-profile-tree-search]") as HTMLInputElement | null; if (search) search.value = "";
      renderTable(); o.onChange(); return;
    }
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-profile-select], [data-evidence-tree-toggle], [data-evidence-tree-more], [data-evidence-tree-page], [data-tree-country], [data-tree-country-reset], [data-profile-country], [data-profile-country-reset]");
    if (!button) return;
    if (button.dataset.profileSelect && nodes.has(button.dataset.profileSelect)) {
      if (state.selected !== button.dataset.profileSelect) { state.countriesOpen = false; state.countrySearch = ""; }
      state.selected = button.dataset.profileSelect;
      state.inspectorOpen = true;
      state.countryScroll = 0;
      inspector();
      const summary = element("[data-profile-inspector]");
      const bounds = summary?.getBoundingClientRect();
      if (window.matchMedia("(max-width: 760px)").matches || (bounds && (bounds.bottom < 0 || bounds.top > innerHeight))) {
        summary?.scrollIntoView({block:"nearest",behavior:"instant"});
      }
      o.onChange();
      return;
    }
    let focus = ".profile-matrix-scroll";
    const id = button.dataset.evidenceTreeToggle;
    if (id) {
      toggleResearchNode(state, id); focus = `[data-evidence-tree-toggle="${CSS.escape(id)}"]`;
    }
    const more = button.dataset.evidenceTreeMore;
    if (more) { const limits = new Map(state.limits); limits.set(more, (limits.get(more) ?? 20) + 20); state.limits = [...limits]; }
    if (button.dataset.evidenceTreePage) state.offset = Math.max(0, state.offset + (button.dataset.evidenceTreePage === "next" ? MATRIX_ROWS : -MATRIX_ROWS));
    if (button.dataset.treeCountry || button.dataset.profileCountry) {
      const code = (button.dataset.treeCountry || button.dataset.profileCountry)!;
      if (o.terminal?.()) {
        const countries = new Set(state.countries);
        if (countries.has(code)) countries.delete(code); else countries.add(code);
        state.countries = [...countries]; state.offset = 0;
        reconcileSelection();
      } else selectCountry(code);
      focus = button.classList.contains("profile-country-chip") ? `.profile-country-chip[data-profile-country="${code}"]` : `.matrix-country-heading[data-tree-country="${code}"]`;
    }
    if (button.hasAttribute("data-tree-country-reset") || button.hasAttribute("data-profile-country-reset")) { selectCountry(""); focus = "[data-profile-country-filter]"; }
    renderTable();
    if (button.dataset.evidenceTreePage) {
      const pane = element(".tree-sheet-scroll"), first = pane?.querySelector<HTMLElement>("tbody tr:not(.tree-context-row)");
      if (pane && first) pane.scrollTop = Math.max(0, first.offsetTop - (pane.querySelector<HTMLElement>("thead")?.offsetHeight ?? 0));
    }
    const target = element(focus);
    (target && !(target as HTMLButtonElement).disabled ? target : element(".profile-matrix-scroll"))?.focus({preventScroll:true});
    o.onChange();
  });
  return {
    capture: () => state ? {...state} : undefined,
    restore: (value?: ProfileExplorerState) => { state = value ? {...value} : undefined; },
    render: (value: SubcladeProfile | null) => {
      deferred.cancel();
      if (!value || !element("[data-profile-tree-view]")) { profile = null; nodes.clear(); return; }
      if (value !== profile) {
        nodes.clear();
        const pending = [value.evidenceTree];
        while(pending.length) { const node = pending.pop()!; nodes.set(node.node.id,node); pending.push(...node.children); }
        profile = value;
      }
      if (state?.anchor !== value.node.id) state = {anchor:value.node.id,selected:value.node.id,rows:MATRIX_ROWS,offset:0,countries:[],opened:compactTreeOpened([value.evidenceTree]),limits:[]};
      if (!nodes.has(state.selected)) state.selected = value.node.id;
      state.countries = state.countries?.filter(code => value.countryCounts.has(code)) ?? [];
      const macro = element("[data-research-macro]") as HTMLSelectElement | null;
      if (state.macro && macro && ![...macro.options].some(option => option.value === state!.macro)) state.macro = "";
      reconcileSelection(true);
      const search = element("[data-profile-tree-search]") as HTMLInputElement | null;
      if (search) search.value = state.query ?? "";
      o.root.querySelectorAll<HTMLDetailsElement>("[data-profile-extra]").forEach(details => {
        details.open = state?.extrasOpen?.includes(details.dataset.profileExtra!) === true;
      });
      inspector(); renderTable();
    },
  };
}
