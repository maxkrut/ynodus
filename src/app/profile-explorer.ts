import type { EvidenceTreeNode, SubcladeProfile } from "../shared/types";
import { MATRIX_ROWS, renderProfileMatrix, type ProfileMatrixOptions } from "./profile-matrix";
import { bindEvidenceTreeKeys } from "./evidence-tree-table";

export type ProfileExplorerState = {
  anchor: string; selected: string; rows: number; offset: number; countryScroll?: number; countriesOpen?: boolean;
  countries?: string[]; closed?: string[]; limits?: Array<[string, number]>; query?: string; treeScrollLeft?: number; inspectorOpen?: boolean;
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
    if (selected && host) host.innerHTML = o.inspector(selected, selected.node.id === profile?.node.id);
    const disclosure = element("[data-profile-inspector-disclosure]") as HTMLDetailsElement | null;
    if (disclosure) disclosure.open = state?.inspectorOpen === true;
    const countries = element("[data-profile-countries]") as HTMLDetailsElement | null;
    if (countries) countries.open = state?.countriesOpen === true;
    const list = element('[data-evidence-list="profile-countries"]');
    if (list) list.scrollTop = state?.countryScroll ?? 0;
    o.root.querySelectorAll<HTMLElement>("[data-profile-select]").forEach(button => {
      const active = button.dataset.profileSelect === state?.selected;
      button.setAttribute("aria-pressed",String(active));
      button.closest(".evidence-tree-node")?.classList.toggle("is-selected",active);
    });
  };
  o.root.addEventListener("toggle", event => {
    const details = event.target;
    if (!state || !(details instanceof HTMLDetailsElement)) return;
    if (details.matches("[data-profile-inspector-disclosure]")) { if (state.inspectorOpen !== details.open) { state.inspectorOpen = details.open; o.onChange(); } return; }
    if (!details.matches("[data-profile-countries]")) return;
    if (state.countriesOpen !== details.open) { state.countriesOpen = details.open; o.onChange(); }
  }, true);
  const renderTable = () => {
    if (!state || !profile) return;
    const tree = element("[data-profile-tree-table]");
    if (tree) tree.innerHTML = renderProfileMatrix(profile, state.rows, state.offset, o, state);
    const pane = element(".tree-sheet-scroll");
    if (pane) { pane.scrollLeft = state.treeScrollLeft ?? 0; state.offset = Number(pane.dataset.treeOffset); }
    const summary = element("[data-profile-inspector]");
    if (summary) summary.hidden = false;
    const countries = state.countries ?? [];
    const select = element("[data-profile-country-filter]") as HTMLSelectElement | null;
    if (select) select.value = countries.length === 1 ? countries[0] : "";
    o.root.querySelectorAll<HTMLButtonElement>(".profile-country-chip").forEach(button => button.setAttribute("aria-pressed",String(countries.includes(button.dataset.profileCountry!))));
    const reset = element(".profile-country-reset") as HTMLButtonElement | null;
    if (reset) reset.disabled = !countries.length;
    const total = element("[data-profile-scope-total]"), label = element("[data-profile-total-label]");
    if (total) total.textContent = o.formatNumber(countries.length ? countries.reduce((sum,code) => sum+(profile!.countryCounts.get(code)??0),0) : profile.total);
    if (label) label.textContent = o.t(countries.length ? "branchCountriesSelectedColumn" : "profileSubtreeEvidence");
  };
  const selectCountry = (code: string) => {
    if (!state || !profile) return;
    state.countries = code && profile.countryCounts.has(code) ? [code] : [];
    state.offset = 0; if (!o.terminal?.()) state.closed = [];
    const node = nodes.get(state.selected);
    if (code && node && !(node.countryCounts.get(code)??0)) { state.selected = profile.node.id; inspector(); }
  };
  o.root.addEventListener("change", event => {
    const select = event.target as HTMLSelectElement;
    if (!state || !select.matches("[data-profile-country-filter]")) return;
    selectCountry(select.value); renderTable(); o.onChange();
  });
  o.root.addEventListener("input", event => {
    const input = event.target as HTMLInputElement;
    if (!state || !input.matches("[data-profile-tree-search]")) return;
    state.query = input.value; state.offset = 0; renderTable(); o.onChange();
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
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-profile-select], [data-evidence-tree-toggle], [data-evidence-tree-more], [data-evidence-tree-page], [data-tree-country], [data-tree-country-reset], [data-profile-country], [data-profile-country-reset]");
    if (!button) return;
    if (button.dataset.profileSelect && nodes.has(button.dataset.profileSelect)) {
      if (state.selected !== button.dataset.profileSelect) state.countriesOpen = false;
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
      const closed = new Set(state.closed); if (closed.has(id)) closed.delete(id); else closed.add(id);
      state.closed = [...closed]; focus = `[data-evidence-tree-toggle="${CSS.escape(id)}"]`;
    }
    const more = button.dataset.evidenceTreeMore;
    if (more) { const limits = new Map(state.limits); limits.set(more, (limits.get(more) ?? 20) + 20); state.limits = [...limits]; }
    if (button.dataset.evidenceTreePage) state.offset = Math.max(0, state.offset + (button.dataset.evidenceTreePage === "next" ? MATRIX_ROWS : -MATRIX_ROWS));
    if (button.dataset.treeCountry || button.dataset.profileCountry) {
      const code = (button.dataset.treeCountry || button.dataset.profileCountry)!;
      if (o.terminal?.()) {
        const all = [...profile.countryCounts.keys()];
        const countries = new Set(all.every(item => state!.countries?.includes(item)) ? [] : state.countries);
        if (countries.has(code)) countries.delete(code); else countries.add(code);
        state.countries = [...countries]; state.offset = 0;
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
      if (!value || !element("[data-profile-tree-view]")) { profile = null; nodes.clear(); return; }
      if (value !== profile) {
        nodes.clear();
        const pending = [value.evidenceTree];
        while(pending.length) { const node = pending.pop()!; nodes.set(node.node.id,node); pending.push(...node.children); }
        profile = value;
      }
      if (state?.anchor !== value.node.id) state = {anchor:value.node.id,selected:value.node.id,rows:MATRIX_ROWS,offset:0,countries:[],closed:[],limits:[]};
      if (!nodes.has(state.selected)) state.selected = value.node.id;
      state.countries = state.countries?.filter(code => value.countryCounts.has(code)) ?? [];
      const search = element("[data-profile-tree-search]") as HTMLInputElement | null;
      if (search) search.value = state.query ?? "";
      inspector(); renderTable();
    },
  };
}
