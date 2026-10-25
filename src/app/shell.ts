import type { TextKey } from "./i18n";
import { renderHeader } from "./shell-header";
import { renderQueryPanel } from "./shell-query";
import { renderTimeline } from "./shell-timeline";
import { renderResultsWorkspace } from "./shell-results";
import { renderResearchWorkspaces } from "./shell-research";
import { renderSelectionDialogs } from "./shell-selection";
import { renderAnnotationPanel } from "./annotation-markup";

export function renderAppShell(t: (key: TextKey) => string): string {
  return `${renderHeader(t)}
    <main id="time-workspace" class="layout" data-research-panel="time">
      ${renderQueryPanel(t)}
      <div class="workspace">${renderTimeline(t)}${renderResultsWorkspace(t)}</div>
    </main>
    ${renderResearchWorkspaces(t)}
    ${renderSelectionDialogs(t)}
    ${renderAnnotationPanel()}`;
}
