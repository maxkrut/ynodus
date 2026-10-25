import { densityStep } from "./density-intervals";
import type { DensityMeasure } from "./density-measure";

type Settings = { step: number; anchor: "axis" | "target"; sync: boolean; measure: DensityMeasure };
const STORAGE_KEY = "ynodus-density-settings-v2";

export function createDensitySettings(root: Element | null, render: () => void) {
  const input = root?.querySelector<HTMLInputElement>("#density-step");
  const anchor = root?.querySelector<HTMLSelectElement>("#density-anchor");
  const sync = root?.querySelector<HTMLInputElement>("#density-sync");
  const measures = root?.querySelectorAll<HTMLButtonElement>("[data-density-measure]");
  let settings: Settings = { step: 300, anchor: "axis", sync: false, measure: "count" };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && typeof saved === "object") settings = {
      step: densityStep(saved.step) || 300, anchor: saved.anchor === "target" ? "target" : "axis", sync: saved.sync === true,
      measure: saved.measure === "per1000" ? "per1000" : "count",
    };
  } catch { /* Optional preference; defaults work without browser storage. */ }
  if (input) input.value = String(settings.step);
  if (anchor) anchor.value = settings.anchor;
  if (sync) sync.checked = settings.sync;
  const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* Optional. */ } };
  const renderMeasure = () => measures?.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.densityMeasure === settings.measure)));
  renderMeasure();
  measures?.forEach(button => button.addEventListener("click", () => {
    settings.measure = button.dataset.densityMeasure === "per1000" ? "per1000" : "count";
    renderMeasure(); save(); render();
  }));
  input?.addEventListener("change", () => {
    const value = densityStep(Number(input.value));
    if (value) { settings.step = value; save(); }
    render();
  });
  input?.addEventListener("keydown", event => {
    if (event.key === "Enter") { event.preventDefault(); input.dispatchEvent(new Event("change")); }
  });
  anchor?.addEventListener("change", () => {
    settings.anchor = anchor.value === "target" ? "target" : "axis"; save(); render();
  });
  sync?.addEventListener("change", () => {
    settings.sync = sync.checked;
    if (!settings.sync && input) input.value = String(settings.step);
    save(); render();
  });
  return (window: number) => {
    if (input) {
      input.disabled = settings.sync;
      if (settings.sync) input.value = String(2 * window);
    }
    return { densityStep: settings.sync ? 2 * window : input ? densityStep(Number(input.value)) : settings.step,
      densityAnchor: settings.anchor, densitySync: settings.sync, densityMeasure: settings.measure };
  };
}
