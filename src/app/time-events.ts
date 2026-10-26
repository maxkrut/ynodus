import type { AppEventBindings } from "./event-bindings";
import { YBP_BASE_YEAR } from "../shared/time";
import { MAX_QUERY_YBP } from "./constants";
import { rememberTargetEraDraft, targetEraDraft } from "./target-date";

export function bindTimeControls(bindings: AppEventBindings): void {
  const {
    state,
    elements,
    queueAnalysis,
    handleTargetChange,
    previewTargetChange,
    renderPresenceMode,
    renderSliceMode,
  } = bindings;

  elements.targetYear.addEventListener("input", () => handleTargetChange("fields"));
  elements.targetYear.addEventListener("blur", () => {
    if (elements.targetYear.value.trim() !== "") return;
    bindings.setTargetFromYbp(bindings.targetYbp());
    queueAnalysis();
  });
  bindDeltaStepper(elements.targetYear);
  elements.targetEra.addEventListener("click", (event) => {
    const currentEra = elements.targetEra.value === "CE" ? "CE" : "BCE";
    const currentYear = Number(elements.targetYear.value);
    if (Number.isFinite(currentYear)) {
      rememberTargetEraDraft(elements.targetYear, currentEra, currentYear);
    }
    const requested = (event.target as HTMLElement).closest<HTMLElement>("[data-era]")?.dataset.era;
    const nextEra = requested === "BCE" || requested === "CE" ? requested : currentEra === "BCE" ? "CE" : "BCE";
    if (nextEra === currentEra) return;
    const maxYear = nextEra === "CE" ? YBP_BASE_YEAR : MAX_QUERY_YBP - YBP_BASE_YEAR + 1;
    const nextDraft = targetEraDraft(elements.targetYear, nextEra)
      ?? Math.max(1, Math.min(Number.isFinite(currentYear) ? currentYear : 1, maxYear));
    elements.targetEra.value = nextEra;
    elements.targetYear.value = String(nextDraft);
    handleTargetChange("fields");
  });
  elements.targetSlider.addEventListener("input", () => previewTargetChange("slider"));
  elements.targetSlider.addEventListener("change", () => handleTargetChange("slider"));
  elements.targetSlider.addEventListener("keydown", (event) => {
    const min = Number(elements.targetSlider.min);
    const max = Number(elements.targetSlider.max);
    const step = Math.max(1, Number(elements.targetSlider.step) || 1);
    const current = Number(elements.targetSlider.value);
    const next = event.key === "ArrowRight" || event.key === "ArrowUp"
      ? current + step
      : event.key === "ArrowLeft" || event.key === "ArrowDown"
        ? current - step
        : event.key === "PageUp"
          ? current + step * 10
          : event.key === "PageDown"
            ? current - step * 10
            : event.key === "Home"
              ? min
              : event.key === "End"
                ? max
                : null;
    if (next === null) return;
    event.preventDefault();
    elements.targetSlider.value = String(Math.max(min, Math.min(max, next)));
    elements.targetSlider.dispatchEvent(new Event("input", { bubbles: true }));
    elements.targetSlider.dispatchEvent(new Event("change", { bubbles: true }));
  });
  bindHorizontalRangePointer(elements.targetSlider);
  elements.targetDensity.addEventListener("click", (event) => {
    jumpToDensityBucket(event.target);
  });
  elements.presenceToggle.addEventListener("click", event => {
    const requested = (event.target as HTMLElement).closest<HTMLElement>("[data-presence]")?.dataset.presence;
    const next = requested === "all" || requested === "any" ? requested : state.presenceMode === "any" ? "all" : "any";
    if (next === state.presenceMode) return;
    state.presenceMode = next;
    renderPresenceMode();
    queueAnalysis();
  });
  elements.presenceToggle.closest("#time-workspace")?.addEventListener("click", event => {
    if (!(event.target as HTMLElement).closest("[data-accept-country-minimum]")
      || state.analysisBusy || !state.countryMinimumOffer || state.presenceMode !== "all"
      || state.committedQuery?.presenceMode !== "all") return;
    state.presenceMode = "any";
    renderPresenceMode();
    queueAnalysis();
    elements.presenceToggle.focus({ preventScroll: true });
  });

  renderSliceMode();
  elements.includeCrossingInput.addEventListener("change", () => {
    const includeCrossing = elements.includeCrossingInput.checked;
    if (state.includeCrossing === includeCrossing) return;
    state.includeCrossing = includeCrossing;
    renderSliceMode();
    queueAnalysis();
  });

  elements.maxDeltaInput.addEventListener("input", () => {
    const parsed = parseYbpNumberInput(elements.maxDeltaInput);
    if (parsed === null) { queueAnalysis(); return; }

    const next = parsed;
    state.maxDeltaYbp = next;
    if (elements.maxDeltaInput.value.trim() !== String(next)) elements.maxDeltaInput.value = String(next);
    queueAnalysis();
  });

  elements.maxDeltaInput.addEventListener("blur", () => {
    if (elements.maxDeltaInput.value.trim() !== "") return;
    elements.maxDeltaInput.value = String(state.maxDeltaYbp);
    queueAnalysis();
  });

  bindDeltaStepper(elements.maxDeltaInput);

  function jumpToDensityBucket(target: EventTarget | null): boolean {
    const bucket = target instanceof HTMLElement
      ? target.closest<HTMLButtonElement>("button[data-target-ybp]")
      : null;
    const rawYbp = bucket?.dataset.targetYbp;
    if (!bucket || !rawYbp || !elements.targetDensity.contains(bucket)) return false;

    const ybp = Number(rawYbp);
    if (!Number.isFinite(ybp)) return false;
    bucket.focus({ preventScroll: true });
    bindings.setTargetFromYbp(ybp);
    queueAnalysis();
    return true;
  }
}

function bindHorizontalRangePointer(input: HTMLInputElement): void {
  let dragging = false;

  const setValueFromPointer = (event: PointerEvent): void => {
    const bounds = input.getBoundingClientRect();
    const min = Number(input.min);
    const max = Number(input.max);
    const step = Math.max(1, Number(input.step) || 1);
    const ratio = bounds.width > 0
      ? Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width))
      : 0.5;
    const raw = min + ratio * (max - min);
    input.value = String(Math.max(min, Math.min(max, min + Math.round((raw - min) / step) * step)));
  };

  input.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    dragging = true;
    input.focus();
    input.setPointerCapture(event.pointerId);
    setValueFromPointer(event);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  input.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    event.preventDefault();
    setValueFromPointer(event);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  input.addEventListener("pointerup", (event) => {
    if (!dragging) return;
    setValueFromPointer(event);
    dragging = false;
    if (input.hasPointerCapture(event.pointerId)) input.releasePointerCapture(event.pointerId);
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  input.addEventListener("pointercancel", () => {
    if (!dragging) return;
    dragging = false;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function bindDeltaStepper(input: HTMLInputElement): void {
  const stepper = input.closest<HTMLElement>(".delta-stepper");
  if (!stepper) return;

  stepper.querySelectorAll<HTMLButtonElement>("[data-delta-step]").forEach((button) => {
    button.dataset.deltaTarget = input.id;
    button.addEventListener("click", () => {
      if (input.disabled) return;

      const step = Number(button.dataset.deltaStep);
      if (!Number.isFinite(step)) return;

      const min = Number(input.min);
      const max = Number(input.max);
      const next = Math.min(
        Number.isFinite(max) && max > 0 ? max : Number.MAX_SAFE_INTEGER,
        Math.max(Number.isFinite(min) ? min : 0, (parseYbpNumberInput(input) ?? 0) + step),
      );
      input.value = String(next);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  });
}

function parseYbpNumberInput(input: HTMLInputElement): number | null {
  const value = input.value.trim();
  if (value === "") return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const max = Number(input.max);
  return Math.min(
    Number.isFinite(max) && max > 0 ? max : Number.MAX_SAFE_INTEGER,
    Math.max(0, Math.round(parsed)),
  );
}
