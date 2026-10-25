import { escapeHtml } from "../shared/html";
import type { Locale, ResearchView, SliceMode } from "../shared/types";
import type { AppElements } from "./elements";
import type { TextKey } from "./i18n";
import type { AppState } from "./state";
import { createResearchMarkup, EVIDENCE_REVEAL_INCREMENT, TREE_REVEAL_INCREMENT,
  type EvidenceRevealKind } from "./research-markup";
import type { WorkerClient } from "./worker-client";
import { createProfileLookup } from "./profile-lookup";
import { createCountryOverviewTree } from "./country-overview-tree";
import { createCountryComparisonPicker } from "./country-comparison-picker";
import { createBranchCountryTree } from "./branch-country-tree";
import { createProfileExplorer } from "./profile-explorer";
import { renderCountryOverviewOptions, renderCountryOverviewView } from "./country-overview-view";
import { sameHistoryRoute, type ResultDetailScope, type ResearchHistoryRoute, type HistoryMode } from "./research-history";
import { resultDetailActive, resultDetailScope, renderResultDetailChrome } from "./result-detail";
import { createResearchNavigation } from "./research-navigation";
import { captureNavigationSnapshot, applyNavigationSnapshot, restoreNavigationInputs } from "./navigation-snapshot";

export type { EvidenceRevealKind } from "./research-markup";
type ResearchControllerOptions = {
  state: AppState;
  locale: () => Locale;
  elements: AppElements;
  workerClient: WorkerClient;
  t: (key: TextKey) => string;
  formatCalendar: (ybp: number) => string;
  formatNumber: (value: number) => string;
  countryName: (code: string) => string;
  countryFlag: (code: string) => string;
  subcladeUrl: (id: string) => string;
  setTargetFromYbp: (ybp: number) => void;
  queueAnalysis: () => void;
  initialRoute?: ResearchHistoryRoute;
  restoreQuery?: () => Promise<void>;
  dismissDialogs?: () => void;
  renderTimeResults?: () => void;
};
type ResearchController = {
  render: () => void;
  showView: (view: ResearchView) => void;
  loadProfile: (clade: string) => Promise<boolean>;
  loadResultDetail: (id: string, mode: SliceMode, child?: string) => Promise<boolean>;
  loadCountryEvidence: (country: string, anchorId: string) => Promise<void>;
  loadCountryOverview: (country: string) => Promise<void>;
  backFromCountryEvidence: () => void; back: () => void;
  restorePosition: () => void;
  searchNearProfileFormation: () => void;
  revealEvidence: (kind: EvidenceRevealKind) => void;
  restoreRoute: (route: ResearchHistoryRoute) => Promise<void>;
};

const INITIAL_COUNTRY_ROWS = 12, INITIAL_BRANCH_ROWS = 16, INITIAL_ASSIGNMENT_ROWS = 40;
export function createResearchController(options: ResearchControllerOptions): ResearchController {
  const { state, elements } = options;
  if (options.initialRoute?.view === "profile") state.resultDetail = options.initialRoute.detail ?? null;
  let requestToken = 0;
  const revealLimits: Record<EvidenceRevealKind, number> = {
    "profile-countries": INITIAL_COUNTRY_ROWS,
    "profile-branches": INITIAL_BRANCH_ROWS,
    "profile-tree": TREE_REVEAL_INCREMENT,
    "profile-formed": EVIDENCE_REVEAL_INCREMENT,
    "country-branches": INITIAL_BRANCH_ROWS,
    "country-assignments": INITIAL_ASSIGNMENT_ROWS,
  };
  const markup = createResearchMarkup({
    ...options,
    resultDetail: () => resultDetailActive(state) ? state.resultDetail : null,
    queryFormedRow: (id) => state.analysisBusy ? undefined : state.results.find((row) => row.node.id === id),
  }, (kind) => revealLimits[kind]);
  const profileExplorer = createProfileExplorer({ ...options, terminal: () => resultDetailActive(state), ancientBreakdown: () => false, root: elements.profileContent,
    inspector: markup.profileInspector, onChange: () => navigation.remember() });
  const profileLookup = createProfileLookup({
    root: elements.profileWorkspace, workerClient: options.workerClient, t: options.t,
    ready: () => !!state.index, active: () => state.researchView === "profile" && !resultDetailActive(state),
    loadFailed: () => !!state.loadErrorDetail,
    profileId: () => state.profile?.node.id, loadProfile,
  });
  const countryTree = createCountryOverviewTree({
    ...options, root: elements.countryOverviewContent, inspector: markup.profileInspector, onChange: () => navigation.remember(),
  });
  const countryPicker = createCountryComparisonPicker({ ...options, root: elements.countryOverviewContent,
    index: () => state.index, onApply: countries => { const country=state.countryOverview?.country; if(country) {
      navigation.revise({view:"country-overview",country,countries}); void loadCountryOverview(country,"none",countries); } } });
  const branchTree = createBranchCountryTree({ ...options, root: elements.countryEvidenceContent,
    onChange: () => navigation.remember(),
    onCountries: countries => { countries = [...new Set(countries)].sort();
      const route = routeForCurrentState();
      if (route.view !== "country") return;
      navigation.revise({ ...route, countries });
      state.countryEvidenceCountries = countries;
      render();
    },
  });

  const navigation = createResearchNavigation({
    initial: options.initialRoute ?? routeForCurrentState(),
    capture: () => captureNavigationSnapshot(state, routeForCurrentState(), revealLimits, countryTree.capture(), branchTree.capture(), profileExplorer.capture()),
    apply: snapshot => { applyNavigationSnapshot(state, snapshot, revealLimits); countryTree.restore(snapshot.tree); branchTree.restore(snapshot.branchTree); profileExplorer.restore(snapshot.profileExplorer); },
    inputs: restoreNavigationInputs,
    refresh: () => { render(); options.renderTimeResults?.(); },
    ready: () => !!state.index && !state.loading && !state.researchBusy && (state.researchView !== "time" || !state.analysisBusy),
    restoreRoute: restoreHistoryRoute, restoreQuery: options.restoreQuery,
    invalidate: invalidateResearchRequest, dismiss: () => options.dismissDialogs?.(), t: options.t,
  });

  function showView(view: ResearchView): void { if (!resultDetailActive(state)) navigation.workspace(view); }
  async function loadResultDetail(id: string, mode: SliceMode, child?: string): Promise<boolean> {
    if (state.analysisBusy || state.researchView !== "time") return false;
    const row = (mode === "crossing" ? state.crossingResults : state.results)
      .find(row => row.node.id === id && row.crossingChild?.id === child);
    return row ? loadProfile(row.crossingChild?.id ?? row.node.id, "push", resultDetailScope(row)) : false;
  }

  async function loadProfile(clade: string, historyMode: HistoryMode = "push", detail?: ResultDetailScope): Promise<boolean> {
    if (historyMode === "push" && resultDetailActive(state)) return false;
    const lookupRevision = profileLookup.beginProfileLoad();
    const token = ++requestToken;
    state.researchBusy = true;
    state.researchError = null;
    navigate({ view: "profile", clade, ...(detail ? { detail } : {}) }, historyMode);
    state.resultDetail = detail ?? null;
    state.profile = null;
    if (historyMode !== "none") profileExplorer.restore();
    render();
    try {
      const response = await options.workerClient.request({ type: "subcladeProfile", clade,
        ...(detail ? { countries: detail.countries } : {}) });
      if (token !== requestToken) return false;
      if (response.type !== "subcladeProfile") throw new Error("Unexpected worker response.");
      if (!response.profile) {
        state.researchError = options.t("signatureNoClade");
        return false;
      }
      state.profile = response.profile;
      state.countryEvidence = null;
      resetRevealLimits("profile");
      return true;
    } catch (error) {
      if (token !== requestToken) return false;
      console.error("Subclade profile request failed", error);
      state.researchError = error instanceof Error ? error.message : String(error);
      return false;
    } finally {
      if (token === requestToken) {
        state.researchBusy = false;
        if (profileLookup.hasNewDraft(lookupRevision)) navigation.keepPosition();
        render();
      }
    }
  }

  async function loadCountryEvidence(country: string, anchorId: string,
    historyMode: HistoryMode = "push", countries = state.researchView === "country" ? state.countryEvidenceCountries : [country]): Promise<void> {
    if (historyMode === "push" && resultDetailActive(state)) return;
    countries = [...new Set(countries)].sort();
    if (historyMode !== "none" && (state.researchView === "profile" || state.researchView === "country-overview")) {
      state.countryEvidenceParentView = state.researchView;
    }
    const token = ++requestToken;
    state.researchBusy = true;
    state.researchError = null;
    navigate({ view: "country", country, anchorId, countries, parentView: state.countryEvidenceParentView }, historyMode);
    state.countryEvidenceCountries = [...countries];
    render();
    try {
      const response = await options.workerClient.request({
        type: "countryEvidence",
        country,
        anchorId,
      });
      if (token !== requestToken) return;
      if (response.type !== "countryEvidence") throw new Error("Unexpected worker response.");
      state.countryEvidence = response.evidence;
      state.countryProfile = response.profile ?? null;
      resetRevealLimits("country");
      if (!response.evidence) state.researchError = options.t("countryEvidenceUnavailable");
    } catch (error) {
      if (token !== requestToken) return;
      state.countryEvidence = null;
      state.countryProfile = null;
      console.error("Country evidence request failed", error);
      state.researchError = error instanceof Error ? error.message : String(error);
    } finally {
      if (token === requestToken) {
        state.researchBusy = false;
        render();
      }
    }
  }
  async function loadCountryOverview(country: string, historyMode: HistoryMode = "push", countries: string[] = [country]): Promise<void> {
    const token = ++requestToken;
    state.researchBusy = true;
    state.researchError = null;
    countries = [...new Set([country,...countries])].sort();
    navigate({ view: "country-overview", country, countries }, historyMode);
    render();
    try {
      const response = await options.workerClient.request({ type: "countryOverview", country, countries });
      if (token !== requestToken) return;
      if (response.type !== "countryOverview") throw new Error("Unexpected worker response.");
      state.countryOverview = response.overview;
      if (!response.overview) state.researchError = options.t("countryOverviewUnavailable");
    } catch (error) {
      if (token !== requestToken) return;
      state.countryOverview = null;
      console.error("Country overview request failed", error);
      state.researchError = error instanceof Error ? error.message : String(error);
    } finally {
      if (token === requestToken) {
        state.researchBusy = false;
        render();
      }
    }
  }

  function searchNearProfileFormation(): void {
    if (resultDetailActive(state)) return;
    const profile = state.profile;
    if (!profile?.node.formedKnown) return;
    options.setTargetFromYbp(profile.node.formed);
    navigate({ view: "time" });
    render();
    options.queueAnalysis();
  }

  function revealEvidence(kind: EvidenceRevealKind): void {
    revealLimits[kind] += kind === "profile-tree" ? TREE_REVEAL_INCREMENT : EVIDENCE_REVEAL_INCREMENT;
    render();
    navigation.remember();
    queueMicrotask(() => {
      const remaining = document.querySelector<HTMLButtonElement>(`[data-reveal-evidence="${kind}"]`);
      if (remaining) {
        remaining.focus();
        return;
      }
      if (kind === "profile-countries") {
        [...document.querySelectorAll<HTMLButtonElement>('[data-evidence-list="profile-countries"] [data-country-evidence]')].at(-1)?.focus();
        return;
      }
      document.querySelector<HTMLElement>(`[data-evidence-progress="${kind}"], [data-evidence-list="${kind}"] button:last-of-type`)?.focus({ preventScroll: true });
    });
  }

  function invalidateResearchRequest(): void {
    requestToken += 1;
    state.researchBusy = false;
  }

  function resetRevealLimits(scope: "profile" | "country"): void {
    Object.assign(revealLimits, scope === "profile" ? {
      "profile-countries": INITIAL_COUNTRY_ROWS, "profile-branches": INITIAL_BRANCH_ROWS,
      "profile-tree": TREE_REVEAL_INCREMENT, "profile-formed": EVIDENCE_REVEAL_INCREMENT,
    } : { "country-branches": INITIAL_BRANCH_ROWS, "country-assignments": INITIAL_ASSIGNMENT_ROWS });
  }

  function render(): void {
    const panels: Array<[ResearchView, HTMLElement]> = [
      ["time", elements.timeWorkspace],
      ["profile", elements.profileWorkspace],
      ["country", elements.countryEvidenceWorkspace],
      ["country-overview", elements.countryOverviewWorkspace],
    ];
    for (const [view, panel] of panels) {
      const inactive = state.researchView !== view;
      panel.hidden = inactive;
      panel.inert = inactive;
      if (typeof panel.setAttribute === "function" && typeof panel.removeAttribute === "function") {
        if (inactive) panel.setAttribute("aria-hidden", "true");
        else panel.removeAttribute("aria-hidden");
      }
    }

    elements.researchViewButtons.forEach((button) => {
      const active = button.dataset.researchView === state.researchView
        || (button.dataset.researchView === state.countryEvidenceParentView && state.researchView === "country");
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });

    renderProfile();
    profileExplorer.render(state.researchView === "profile" && !state.researchBusy && !state.researchError ? state.profile : null);
    renderCountryEvidence();
    const countryOverviewOptions = { state, elements, markup, t: options.t,
      countryName: options.countryName, locale: options.locale };
    renderCountryOverviewView(countryOverviewOptions);
    countryTree.render(state.researchView === "country-overview" && !state.researchBusy && !state.researchError
      ? state.countryOverview : null);
    countryPicker.render(state.researchView === "country-overview" && !state.researchBusy && !state.researchError ? state.countryOverview : null);
    branchTree.render(state.researchView === "country" && !state.researchBusy && !state.researchError
      ? state.countryProfile : null, state.countryEvidenceCountries);
    renderCountryOverviewOptions(countryOverviewOptions);
    profileLookup.render();
    renderResultDetailChrome(state, elements, options.t);
    navigation.render();
    navigation.flush();
  }

  function navigate(route: ResearchHistoryRoute, historyMode: HistoryMode = "push"): void {
    if (route.view !== state.researchView) options.dismissDialogs?.();
    navigation.navigate(route, historyMode);
    state.researchView = route.view;
  }

  async function restoreHistoryRoute(route: ResearchHistoryRoute): Promise<void> {
    options.dismissDialogs?.();
    invalidateResearchRequest();
    state.researchError = null;
    if (route.view === "profile" && !route.clade) { state.profile = null; state.resultDetail = null; }
    if (route.view === "country-overview" && !route.country) state.countryOverview = null;
    if (route.view === "profile" && route.clade) {
      if (!sameHistoryRoute({ view: "profile", clade: state.profile?.node.id ?? null,
        detail: state.resultDetail ?? undefined }, route)) {
        await loadProfile(route.clade, "none", route.detail);
        return;
      }
    } else if (route.view === "country" && route.country && route.anchorId) {
      state.countryEvidenceParentView = route.parentView ?? "profile";
      if (
        state.countryEvidence?.country !== route.country
        || state.countryEvidence.anchor.id !== route.anchorId
      ) {
        await loadCountryEvidence(route.country, route.anchorId, "none", route.countries ?? [route.country]);
        return;
      }
      state.countryEvidenceCountries = route.countries ?? [route.country];
    } else if (route.view === "country-overview" && route.country) {
      if (!sameHistoryRoute({ view:"country-overview", country:state.countryOverview?.country??null, countries:state.countryOverview?.countries },route)) {
        await loadCountryOverview(route.country, "none", route.countries);
        return;
      }
    }
    state.researchView = route.view;
    render();
  }

  function routeForView(view: ResearchView): ResearchHistoryRoute {
    if (view === "profile") return { view, clade: state.profile?.node.id ?? null,
      ...(state.resultDetail ? { detail: state.resultDetail } : {}) };
    if (view === "country") {
      return {
        view,
        country: state.countryEvidence?.country ?? null,
        anchorId: state.countryEvidence?.anchor.id ?? null,
        parentView: state.countryEvidenceParentView,
        countries: state.countryEvidenceCountries,
      };
    }
    if (view === "country-overview") return { view, country: state.countryOverview?.country ?? null, countries:state.countryOverview?.countries };
    return { view };
  }

  function routeForCurrentState(): ResearchHistoryRoute { return routeForView(state.researchView); }
  function renderProfile(): void {
    if (state.researchView !== "profile") {
      elements.profileContent.replaceChildren();
      return;
    }
    if (state.researchBusy || state.researchError) {
      elements.profileContent.innerHTML = state.researchBusy
        ? markup.loading() : markup.error(state.researchError!);
      return;
    }
    if (!state.profile) {
      elements.profileContent.replaceChildren();
      return;
    }
    elements.profileContent.innerHTML = markup.profile(state.profile);
  }

  function renderCountryEvidence(): void {
    if (state.researchView !== "country") {
      elements.countryEvidenceContent.replaceChildren();
      return;
    }
    if (state.researchBusy || state.researchError) {
      elements.countryEvidenceContent.innerHTML = state.researchBusy
        ? markup.loading() : markup.error(state.researchError!);
      return;
    }
    if (!state.countryEvidence) {
      elements.countryEvidenceContent.innerHTML = `<section class="research-empty-panel"><p>${escapeHtml(options.t("countryEvidenceUnavailable"))}</p></section>`;
      return;
    }
    elements.countryEvidenceContent.innerHTML = markup.countryEvidence(state.countryEvidence, state.countryProfile, state.countryEvidenceCountries);
  }

  return {
    render, showView, loadProfile, loadResultDetail,
    loadCountryEvidence, loadCountryOverview,
    backFromCountryEvidence: navigation.back, back: navigation.back, restorePosition: navigation.flush,
    searchNearProfileFormation, revealEvidence,
    restoreRoute: restoreHistoryRoute,
  };
}
