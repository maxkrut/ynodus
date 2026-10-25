import { escapeHtml as h } from "../shared/html";
import type { TextKey } from "./i18n";
import { readSampleScope } from "./sample-scope";
import { renderAnnotation } from "./annotation-markup";

export function renderResearchSampleControl(id: string, t: (key: TextKey) => string, fixed = false): string {
  const scope = readSampleScope();
  const options = (["all", "modern", "ancient"] as const).map(value =>
    `<option value="${value}"${value === scope ? " selected" : ""}>${h(t(value === "all" ? "samplesAll" : value === "modern" ? "samplesModern" : "samplesAncientOnly"))}</option>`).join("");
  return `<div class="profile-compact-control"><div class="annotated-label"><label for="${h(id)}">${h(t("sampleScopeLabel"))}</label>${renderAnnotation(fixed ? "result-detail" : "sample-scope",t)}</div><select id="${h(id)}" data-active-sample-scope="${scope}" ${fixed ? "disabled" : "data-sample-scope-control"}>${options}</select></div>`;
}
