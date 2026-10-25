import { escapeHtml } from "../shared/html";
import { byId } from "./dom";
import type { TextKey } from "./i18n";

type StatusContext = {
  t: (key: TextKey) => string;
};

export function renderLiveStatusState(
  analysisBusy: boolean,
  context: Pick<StatusContext, "t">,
  resultsReady = true,
): void {
  const liveStatus = byId<HTMLElement>("live-status");
  liveStatus.textContent = context.t(analysisBusy ? "liveUpdating" : resultsReady ? "liveStatus" : "liveIdle");
  liveStatus.dataset.busy = String(analysisBusy);
  const jump = document.getElementById("query-results-jump") as HTMLButtonElement | null;
  if (jump) jump.disabled = analysisBusy || !resultsReady;
  if (analysisBusy || !resultsReady) {
    const summary = document.getElementById("query-result-summary");
    if (summary) summary.hidden = true;
  }
}

export function setEmptyMessage(message: string): void {
  byId("empty-state").innerHTML = `<div class="empty-title">${escapeHtml(message)}</div>`;
}
