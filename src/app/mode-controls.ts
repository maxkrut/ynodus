import type { PresenceMode } from "../shared/types";
import { setText } from "./dom";
import type { TextKey } from "./i18n";

type ModeControlContext = {
  t: (key: TextKey) => string;
};

export function renderPresenceModeControls(
  toggle: HTMLButtonElement,
  presenceMode: PresenceMode,
  context: ModeControlContext,
): void {
  const everyCountry = presenceMode === "all";
  toggle.value = presenceMode;
  toggle.classList.toggle("is-on", everyCountry);
  toggle.setAttribute("aria-checked", String(everyCountry));
  setText("presence-current", context.t(everyCountry ? "everyCountry" : "anyCountry"));
  setText("presence-switch-label", context.t(everyCountry ? "presenceEveryCountryLabel" : "presenceAnyLabel"));
  const hint = presenceMode === "all"
    ? context.t("modeAllHint")
    : context.t("modeAnyHint");
  setText("mode-hint", hint);
  toggle.setAttribute("data-tooltip", hint);
  toggle.title = hint;
  const minimum = document.querySelector<HTMLInputElement>("#min-result-samples");
  if (minimum) minimum.disabled = !everyCountry;
  const description = document.querySelector<HTMLElement>("#min-result-samples-description");
  if (description) {
    const key = everyCountry ? "minResultSamplesDescription" : "minResultSamplesIgnored";
    description.dataset.i18n = key;
    description.textContent = context.t(key);
  }
}

export function renderCrossingOptionControl(
  input: HTMLInputElement,
  includeCrossing: boolean,
  _context: ModeControlContext,
): void {
  input.checked = includeCrossing;
}
