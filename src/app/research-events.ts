import type { AppEventBindings } from "./event-bindings";

export function bindResearchEvents(bindings: AppEventBindings): void {
  const { elements } = bindings;
  document.querySelectorAll("[data-research-back]").forEach(button => {
    button.addEventListener("click", bindings.backResearchView);
  });
  // Safari does not focus buttons on pointer clicks; capture the actual opener consistently.
  document.addEventListener("click", event => {
    const opener = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-open-result-detail], [data-open-profile-subclade], [data-country-evidence-anchor], [data-profile-option]",
    );
    opener?.focus({ preventScroll: true });
  }, true);
  elements.profileWorkspace.addEventListener("input", (event) => {
    const input = event.target as HTMLInputElement;
    if (!input.matches("[data-profile-country-search]")) return;
    const query = input.value.trim().toLocaleLowerCase();
    const rows = [...elements.profileWorkspace.querySelectorAll<HTMLElement>("[data-country-search-text]")];
    const exactCode = rows.some(row => row.dataset.countrySearchText?.split(" ")[0] === query);
    rows.forEach(row => {
      const text = row.dataset.countrySearchText ?? "";
      row.hidden = query ? !(exactCode ? text.split(" ")[0] === query : text.includes(query)) : row.dataset.countryCollapsed === "true";
    });
    const reveal = elements.profileWorkspace.querySelector<HTMLElement>('[data-reveal-evidence="profile-countries"]');
    if (reveal) reveal.hidden = Boolean(query);
    const empty = elements.profileWorkspace.querySelector<HTMLElement>("[data-profile-country-empty]");
    if (empty) empty.hidden = Boolean(elements.profileWorkspace.querySelector('[data-country-search-text]:not([hidden])'));
  });

  elements.researchViewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.researchView;
      if (view !== "time" && view !== "profile" && view !== "country-overview") return;
      bindings.showResearchView(view);
    });
  });

  document.getElementById("country-overview-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const country = elements.countryOverviewSelect.value;
    if (country) void bindings.loadCountryOverview(country);
  });

  elements.countryOverviewWorkspace.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const profile = target.closest<HTMLButtonElement>("[data-open-profile-subclade]");
    if (profile?.dataset.openProfileSubclade) { void bindings.loadProfile(profile.dataset.openProfileSubclade); return; }
    const revealButton = target.closest<HTMLButtonElement>("[data-reveal-evidence]");
    if (revealButton) {
      bindings.revealEvidence(revealButton.dataset.revealEvidence as Parameters<typeof bindings.revealEvidence>[0]);
      return;
    }
    const branch = target.closest<HTMLButtonElement>("[data-country-evidence-anchor]");
    if (branch?.dataset.countryEvidence && branch.dataset.countryEvidenceAnchor) {
      void bindings.loadCountryEvidence(branch.dataset.countryEvidence, branch.dataset.countryEvidenceAnchor);
    }
  });

  elements.profileWorkspace.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const revealButton = target.closest<HTMLButtonElement>("[data-reveal-evidence]");
    if (revealButton) {
      bindings.revealEvidence(revealButton.dataset.revealEvidence as Parameters<typeof bindings.revealEvidence>[0]);
      return;
    }
    if (target.closest("[data-search-profile-formed]")) {
      bindings.searchNearProfileFormation();
      return;
    }
    const countryButton = target.closest<HTMLButtonElement>("[data-country-evidence]");
    const country = countryButton?.dataset.countryEvidence;
    const anchorId = countryButton?.dataset.countryEvidenceAnchor;
    if (country && anchorId) void bindings.loadCountryEvidence(country, anchorId);

    const branchButton = target.closest<HTMLButtonElement>("[data-open-profile-subclade]");
    const clade = branchButton?.dataset.openProfileSubclade;
    if (clade) void bindings.loadProfile(clade);
  });

  elements.countryEvidenceWorkspace.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const countryBranch = target.closest<HTMLButtonElement>("[data-country-evidence-anchor]");
    if (countryBranch?.dataset.countryEvidence && countryBranch.dataset.countryEvidenceAnchor) {
      void bindings.loadCountryEvidence(countryBranch.dataset.countryEvidence, countryBranch.dataset.countryEvidenceAnchor);
      return;
    }
    const revealButton = target.closest<HTMLButtonElement>("[data-reveal-evidence]");
    if (revealButton) {
      bindings.revealEvidence(revealButton.dataset.revealEvidence as Parameters<typeof bindings.revealEvidence>[0]);
      return;
    }
    const branchButton = target.closest<HTMLButtonElement>("[data-open-profile-subclade]");
    const clade = branchButton?.dataset.openProfileSubclade;
    if (clade) void bindings.loadProfile(clade);
  });
}
