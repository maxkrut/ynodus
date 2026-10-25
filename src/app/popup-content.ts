import { escapeHtml as h, renderTextParagraphs } from "../shared/html";
import type { TextKey } from "./i18n";

/** Plain tooltip text is escaped here; source strings never become markup. */
export function tooltipContent(anchor: HTMLElement, t: (key: TextKey) => string): string {
  const text = anchor.getAttribute("title") || anchor.dataset.tooltip || "";
  if (anchor.hasAttribute("title")) {
    anchor.dataset.tooltip = text;
    anchor.removeAttribute("title");
  }
  const lines = text.split("\n").filter(Boolean);
  if (!anchor.matches(".density-cell")) {
    return `<strong>${h(anchor.dataset.popupTitle || t("annotationExplanation"))}</strong>${renderTextParagraphs(text)}`;
  }
  const entries = lines.map(line => {
    const split = line.indexOf(":");
    return { key: split < 0 ? "" : line.slice(0, split), value: split < 0 ? line : line.slice(split + 1).trim() };
  });
  const branches = entries.find(entry => entry.key === t("densityBucketMatches"));
  const parentDetail = entries.filter(entry => entry.key === t("densityParentLargest") || entry.key === t("densityParentUnknown"));
  const facts = entries.filter(entry => entry !== branches && !parentDetail.includes(entry) && entry.key !== t("densityJumpToDate"));
  const date = (value: string) => `<span class="popup-date">${h(value)}</span>`;
  const fact = (entry: { key: string; value: string }) => entry.key === t("densityBucketRange")
    ? `<div class="popup-range"><dt>${h(entry.key)}</dt><dd>${entry.value.split(" - ").map(date).join("<span aria-hidden=\"true\">-</span>")}</dd></div>`
    : `<div><dt>${h(entry.key)}</dt><dd>${h(entry.value)}</dd></div>`;
  const branch = (value: string) => value.split(" · ").map((part, index) => index === 1 ? date(part) : h(part)).join(" · ");
  return `<strong>${h(t("densityIntervalTitle"))}</strong>
    <dl class="annotation-facts">${facts.map(fact).join("")}</dl>
    <p>${h(t(anchor.closest('[data-density-count-unit="parents"]') ? "densityParentPopup" : "densityCountsHintShort"))}</p>
    ${parentDetail.length ? `<details class="popup-section"><summary>${h(t("densityParentGroups"))}</summary><dl class="annotation-facts">${parentDetail.map(fact).join("")}</dl></details>` : ""}
    ${branches ? `<div class="popup-section"><b>${h(branches.key)}</b><ul>${branches.value.split("; ").map(value => `<li>${branch(value)}</li>`).join("")}</ul></div>` : ""}
    <p class="popup-action">${h(t("densityClickDate")).replace("{date}", date(anchor.dataset.targetLabel || ""))}</p>`;
}
