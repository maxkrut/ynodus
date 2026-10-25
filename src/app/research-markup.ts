import type { CountryEvidence, SubcladeProfile } from "../shared/types";
import { escapeHtml } from "../shared/html";
import { runtimeErrorSummary } from "./runtime-errors";
import { renderCountryBranch } from "./branch-country-view";
import { createProfileMarkup } from "./profile-markup";
import { renderCountryOverviewMarkup } from "./country-overview-markup";
import type { EvidenceRevealKind, ResearchMarkup, ResearchMarkupOptions } from "./research-markup-shared";

export type { EvidenceRevealKind } from "./research-markup-shared";
export { EVIDENCE_REVEAL_INCREMENT, TREE_REVEAL_INCREMENT } from "./research-markup-shared";

/** Stable entry point for the research controller and its presentation state. */
export function createResearchMarkup(
  options: ResearchMarkupOptions,
  revealLimit: (kind: EvidenceRevealKind) => number,
): ResearchMarkup {
  const { profile, profileInspector } = createProfileMarkup(options, revealLimit);

  function countryEvidence(evidence: CountryEvidence, profile: SubcladeProfile | null = null, countries = [evidence.country]): string {
    return renderCountryBranch(evidence, profile, countries, options);
  }

  return {
    profile,
    profileInspector,
    countryEvidence,
    countryOverview: (overview) => renderCountryOverviewMarkup(overview, options),
    loading: () => `<section class="research-empty-panel" aria-busy="true"><p>${escapeHtml(options.t("loading"))}</p></section>`,
    error: (message) => `<section class="research-empty-panel is-error">
      <strong>${escapeHtml(runtimeErrorSummary(message, options.t, "research"))}</strong>
      <details class="error-diagnostics">
        <summary>${escapeHtml(options.t("technicalDetails"))}</summary>
        <code>${escapeHtml(message)}</code>
      </details>
    </section>`,
  };
}
