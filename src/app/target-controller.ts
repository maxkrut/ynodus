import type { AppState } from "./state";
import type { TextKey } from "./i18n";
import type { Locale } from "../shared/types";
import { createDensitySettings } from "./density-settings";
import { createDensityController } from "./density-controller";
import { densityIntervals as chartIntervals } from "./density-intervals";
import { sliderRangeMax } from "./time-slider";
import type { WorkerClient } from "./worker-client";
import {
  renderTargetControls,
  setTargetControlsFromYbp,
  targetYbpFromControls,
  ybpFromTargetSlider,
  type TargetControlContext,
  type TargetControlElements,
} from "./target-controls";

type TargetControllerDeps = TargetControlElements & {
  state: AppState;
  locale: () => Locale;
  t: (key: TextKey) => string;
  formatNumber: (value: number) => string;
  workerClient: () => WorkerClient;
};

export function createTargetController(deps: TargetControllerDeps) {
  let resizeFrame = 0;
  let settled: { index: AppState["index"]; key: string; rows: AppState["results"]; density: AppState["densityRows"] } | undefined;
  const root = deps.targetYear.closest("#time-workspace");
  const queryFields = [deps.targetYear, root?.querySelector<HTMLInputElement>("#max-delta-ybp"),
    root?.querySelector<HTMLInputElement>("#min-result-samples")];
  const chartSettings = createDensitySettings(deps.targetYear.closest("#time-workspace"), () => renderTarget());
  const ensureDensity = createDensityController(deps.state, deps.workerClient, () => renderTarget());
  function densityIntervals() {
    const settings = chartSettings(deps.state.maxDeltaYbp);
    return chartIntervals(settings.densityStep, sliderRangeMax(true),
      { fullRange: true, maxFormedYbp: deps.state.index?.maxFormedYbp ?? 0 },
      settings.densityAnchor === "target" ? targetYbpFromControls(elements()) : undefined);
  }
  if (typeof window !== "undefined") {
    window.addEventListener("resize", () => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => renderTarget());
    });
    document.fonts?.addEventListener("loadingdone", () => renderTarget());
    const axis = deps.targetSlider.closest(".time-axis");
    if (axis && typeof ResizeObserver !== "undefined") {
      let previousWidth = -1;
      new ResizeObserver(([entry]) => {
        const width = entry.contentRect.width;
        if (width === previousWidth) return;
        previousWidth = width;
        if (!width) return;
        window.cancelAnimationFrame(resizeFrame);
        resizeFrame = window.requestAnimationFrame(() => renderTarget());
      }).observe(axis);
    }
  }

  function elements(): TargetControlElements {
    return {
      targetYear: deps.targetYear,
      targetEra: deps.targetEra,
      targetSlider: deps.targetSlider,
      targetDensity: deps.targetDensity,
      targetDensitySummary: deps.targetDensitySummary,
    };
  }

  function context(): TargetControlContext {
    const state = deps.state;
    const key = JSON.stringify([targetYbpFromControls(elements()), state.maxDeltaYbp,
      state.presenceMode, state.minResultSamples, [...state.selectedCountries].sort()]);
    const draft = queryFields.some(input => input?.value.trim() === "");
    const query = state.committedQuery;
    const committedKey = query && JSON.stringify([query.targetYbp, query.maxDeltaYbp,
      query.presenceMode, query.minResultSamples, [...query.selectedCountries].sort()]);
    if (state.loading || (settled && settled.index !== state.index)) settled = undefined;
    if (!state.analysisBusy && !draft && committedKey === key) {
      settled = { index: state.index, key, rows: state.results, density: state.densityRows };
    }
    // Crossing is a separate table. An unchanged Formed query remains valid
    // while that table loads, including during chart-only settings changes.
    const formedReady = !draft && state.analysisBusy && settled?.key === key && settled.density === state.densityRows;
    const density = ensureDensity(densityIntervals());
    return {
      locale: deps.locale(),
      ...chartSettings(deps.state.maxDeltaYbp),
      densityRows: deps.state.densityRows,
      densityGrid: density.intervals,
      resultRows: formedReady ? settled!.rows : state.results,
      maxDeltaYbp: deps.state.maxDeltaYbp,
      maxFormedYbp: deps.state.index?.maxFormedYbp ?? 0,
      // The timeline is always the Formed context map. Optional Crossing rows
      // are a separate result set and must not replace its Hit-window overlay.
      sliceMode: "formed",
      densityStatus: state.loading || density.pending || (state.analysisBusy && !formedReady) ? "pending"
        : density.error || deps.state.loadErrorDetail || deps.state.emptyErrorMessage ? "error"
        : deps.state.index && !deps.state.selectedCountries.size ? "no-selection"
        : state.committedQuery || formedReady ? "ready" : "pending",
      t: deps.t,
      formatNumber: deps.formatNumber,
    };
  }

  function renderTarget(renderDensity = true): void {
    renderTargetControls(elements(), context(), renderDensity);
  }

  function setTargetFromYbp(ybp: number, syncSlider = true): void {
    setTargetControlsFromYbp(elements(), context(), ybp, syncSlider);
  }

  function previewTargetFromYbp(ybp: number, syncSlider = true): void {
    setTargetControlsFromYbp(elements(), context(), ybp, syncSlider, false);
  }

  return {
    densityIntervals,
    renderTarget,
    setTargetFromYbp,
    previewTargetFromYbp,
    targetYbp(): number {
      return targetYbpFromControls(elements());
    },
    handleTargetInput(source: "fields" | "slider", preview = false): void {
      if (source === "slider") {
        const ybp = ybpFromTargetSlider(elements(), context());
        if (preview) previewTargetFromYbp(ybp, false);
        else setTargetFromYbp(ybp, false);
      } else {
        renderTarget(false);
      }
    },
  };
}
