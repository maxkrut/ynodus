import { escapeHtml as h } from "../shared/html";
import type { TextKey } from "./i18n";
import { readSampleScope } from "./sample-scope";
import { renderAnnotation } from "./annotation-markup";

export function renderResearchSampleControl(id: string, t: (key: TextKey) => string): string {
  const scope = readSampleScope();
  const options = (["all", "modern", "ancient"] as const).map(value =>
    `<option value="${value}"${value === scope ? " selected" : ""}>${h(t(value === "all" ? "samplesAll" : value === "modern" ? "samplesModern" : "samplesAncient"))}</option>`).join("");
  return `<div class="profile-compact-control"><div class="annotated-label"><label for="${h(id)}">${h(t("sampleScopeLabel"))}</label>${renderAnnotation("sample-scope",t)}</div><select id="${h(id)}" data-sample-scope-control>${options}</select></div>`;
}
