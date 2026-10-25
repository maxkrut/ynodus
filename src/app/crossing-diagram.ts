import { escapeHtml as h } from "../shared/html";
import type { TextKey } from "./i18n";

/** Two schematic examples, independent of the current query and source records. */
export function renderCrossingDiagram(t: (key: TextKey) => string): string {
  const label = (key: TextKey) => h(t(key));
  return `<figure class="crossing-mini-figure">
    <figcaption class="crossing-mini-caption">${label("crossingDiagramCases")}</figcaption>
    <svg viewBox="0 0 360 140" role="img" aria-label="${label("crossingDiagramDescription")}">
      <rect class="crossing-mini-window" x="198" y="31" width="34" height="96" rx="3" />
      <line class="crossing-mini-date" x1="215" x2="215" y1="22" y2="128" />
      <text class="crossing-mini-target" x="215" y="13" text-anchor="middle">${label("crossingDiagramDate")}</text>
      <text class="crossing-mini-row" x="9" y="59">Formed</text>
      <text class="crossing-mini-small" x="9" y="74">${label("crossingDiagramInWindow")}</text>
      <line class="crossing-mini-axis" x1="111" x2="334" y1="60" y2="60" />
      <circle class="crossing-mini-filled" cx="207" cy="60" r="5" />
      <text class="crossing-mini-row" x="9" y="104">${label("crossingDiagramTransition")}</text>
      <path class="crossing-mini-edge" d="M 120 103 H 301" />
      <path class="crossing-mini-arrow" d="M 300 99 L 307 103 L 300 107 Z" />
      <circle class="crossing-mini-hollow" cx="120" cy="103" r="4.5" />
      <circle class="crossing-mini-hollow" cx="310" cy="103" r="4.5" />
      <text class="crossing-mini-small" x="120" y="125" text-anchor="middle">${label("crossingDiagramParent")}</text>
      <text class="crossing-mini-small" x="310" y="125" text-anchor="middle">${label("crossingDiagramChild")}</text>
    </svg>
    <div class="crossing-mini-legend">
      <span><i class="crossing-key-date" aria-hidden="true"></i>${label("crossingDiagramDate")}</span>
      <span><i class="crossing-key-window" aria-hidden="true"></i>${label("crossingDiagramWindow")}</span>
      <span class="crossing-point-key"><i class="crossing-key-filled" aria-hidden="true"></i>${label("crossingDiagramFilled")}</span>
      <span class="crossing-point-key"><i class="crossing-key-hollow" aria-hidden="true"></i>${label("crossingDiagramHollow")}</span>
      <span class="crossing-point-key"><i class="crossing-key-edge" aria-hidden="true"></i>${label("crossingDiagramEdge")}</span>
    </div>
  </figure>`;
}
