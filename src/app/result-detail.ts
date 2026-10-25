import type { AppState } from "./state";
import type { AppElements } from "./elements";
import type { TextKey } from "./i18n";
import type { ResultRow } from "../shared/types";
import type { ResultDetailScope } from "./research-history";

export const resultDetailActive = (state: AppState): boolean => state.researchView === "profile" && !!state.resultDetail;

export function resultDetailScope(row: ResultRow): ResultDetailScope {
  return { mode: row.crossingChild ? "crossing" : "formed",
    countries: [...row.countryCounts].filter(([, count]) => count > 0).map(([code]) => code).sort(),
    ...(row.crossingChild ? { parentId: row.node.id } : {}) };
}

/** A terminal result page reuses local tree inspection, without workspace or scope navigation. */
export function renderResultDetailChrome(state: AppState, elements: AppElements, t: (key: TextKey) => string): void {
  const active = resultDetailActive(state);
  elements.profileWorkspace.classList.toggle("is-result-detail", active);
  const lookup = elements.profileWorkspace.querySelector<HTMLElement>("#profile-lookup");
  if (lookup) { lookup.hidden = active; lookup.inert = active; }
  elements.researchViewButtons.forEach(button => { button.hidden = active; button.disabled = active; });
  for (const [selector, normal, detail] of [
    ["#profile-workspace-title", state.profile ? "subcladeProfileView" : "profileQuestion", "resultDetailTitle"],
    [".research-workspace-heading > div > p", "profileWorkspaceCopy", "resultDetailHint"],
    [".nested-page-breadcrumb > strong", "subcladeProfileView", "resultDetailTitle"],
  ] as const) {
    const node = elements.profileWorkspace.querySelector<HTMLElement>(selector);
    if (node && (active || node.dataset.i18n === detail)) {
      node.dataset.i18n = active ? detail : normal;
      node.textContent = t(active ? detail : normal);
    }
  }
}
