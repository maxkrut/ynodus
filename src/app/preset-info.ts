import { escapeHtml } from "../shared/html";
import type { CountryPreset } from "../shared/types";
import type { CountryPanelContext } from "./country-panel";

export function renderPresetInfo(preset: CountryPreset, context: CountryPanelContext): string {
  const guide = preset.guide;
  if (!guide) return "";
  const t = context.t;
  const section = (title: string, text: string) => `<section><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p></section>`;
  const unavailable = context.index ? preset.countries.filter(code => !context.index!.countries.has(code)) : [];
  return `
    <div class="preset-info-body">
      ${guide.period ? section(t("presetPeriod"), context.localizedText(guide.period)) : ""}
      ${section(t(guide.period ? "presetRegion" : "presetBasis"), context.localizedText(guide.region))}
      ${unavailable.length ? `<p class="preset-info-muted">${t("presetUnavailable")}: ${unavailable.map(escapeHtml).join(", ")}</p>` : ""}
      ${section(t("presetAssumption"), context.localizedText(guide.selection))}
      <p class="preset-info-caveat">${t(guide.period ? "presetHistoryCaveat" : "presetSelectionCaveat")}</p>
      <section class="preset-info-sources"><h3>${t("presetSources")}</h3>
        ${guide.sources.length ? `<ul>${guide.sources.map(source => `<li><a href="${escapeHtml(source.url)}" tabindex="0" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}</a></li>`).join("")}</ul>` : ""}
        <p>${t(guide.sources.length ? "presetSourceScope" : "presetEditorialScope")}</p>
      </section>
      <p class="preset-info-muted">${t("presetDateUnchanged")}</p>
    </div>`;
}
