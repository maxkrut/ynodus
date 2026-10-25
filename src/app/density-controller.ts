import { densityScopeIdentity } from "../shared/density-identity";
import type { DensityInterval } from "./density-intervals";
import type { AppState } from "./state";
import type { WorkerClient } from "./worker-client";

/** Chart-only interval changes do not reclassify the tables or invalidate CSV. */
export function createDensityController(state: AppState, client: () => WorkerClient, render: () => void) {
  let desired = "", pending = "", failed = "";
  let lastGrid: DensityInterval[] | undefined;
  return (intervals: DensityInterval[]) => {
    const index = state.index;
    if (!index || state.loading || !state.selectedCountries.size || !intervals.length) {
      desired = ""; lastGrid = undefined;
      return { pending: false, error: false, intervals };
    }
    const countries = [...state.selectedCountries].sort();
    const key = densityScopeIdentity(index, countries, state.presenceMode, null, state.minResultSamples, intervals);
    desired = key;
    if (state.densityKey === key) {
      lastGrid = intervals;
      return { pending: false, error: false, intervals };
    }
    if (!state.analysisBusy && !state.emptyErrorMessage && pending !== key && failed !== key) {
      pending = key;
      void client().request({ type: "density", selectedCountries: countries,
        presenceMode: state.presenceMode, minSamples: state.minResultSamples, intervals }).then(reply => {
        if (desired !== key || state.index !== index) return;
        if (reply.type !== "density" || reply.densityKey !== key) throw new Error("Unexpected chart interval scope.");
        state.densityRows = reply.densityRows; state.densityKey = reply.densityKey;
        failed = "";
      }).catch(error => {
        if (desired !== key || state.index !== index) return;
        failed = key;
        state.densityRows = []; state.densityKey = null;
        console.error("Chart interval request failed", error);
      }).finally(() => {
        if (pending === key) pending = "";
        if (desired === key && state.index === index) render();
      });
    }
    return { pending: failed !== key, error: failed === key, intervals: lastGrid ?? intervals };
  };
}
