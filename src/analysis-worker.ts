import { annotateTime, annotateProfile, annotateCountry, annotateOverview } from "./worker/ancient-evidence";
import { buildIndex, summarizeIndex } from "./worker/index-builder";
import {
  collectTimeMatchResults,
  resetSliceAnalysisCaches,
  signatureOptionsForQuery,
} from "./worker/slice-analysis";
import { createLatestOnlyScheduler } from "./worker/latest-only";
import { countryEvidenceForBranch, countryOverviewForCountry, subcladeProfileForClade } from "./worker/evidence-profile";
import type {
  HrasIndex,
  TreeIndex,
  WorkerRequest,
  WorkerResponse,
} from "./worker/types";

let index: TreeIndex | null = null;
let latestLoadId = 0;
const analyzeScheduler = createLatestOnlyScheduler<Extract<WorkerRequest, { type: "analyze" }>>(
  handleAnalyze,
);

self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  if (event.data.type === "cancelLoad") {
    if (event.data.loadId === latestLoadId) latestLoadId = event.data.id;
    return;
  }
  if (event.data.type === "analyze") {
    analyzeScheduler.enqueue(event.data);
    return;
  }
  if (event.data.type === "load") latestLoadId = event.data.id;
  void handleMessage(event.data);
});

function handleAnalyze(message: Extract<WorkerRequest, { type: "analyze" }>): void {
  try {
    const value = ensureIndex();
    const result = collectTimeMatchResults(value, {
      target: message.target,
      selectedCountries: message.selectedCountries,
      presenceMode: message.presenceMode,
      maxDeltaYbp: message.maxDeltaYbp,
      minSamples: message.minSamples,
      anchorId: message.anchorId,
      scopeAllCountries: message.scopeAllCountries,
      knownDensityKey: message.knownDensityKey,
      includeCrossing: message.includeCrossing,
    });
    annotateTime(value, result);
    post({
      id: message.id,
      type: "analyze",
      result,
    });
  } catch (error) {
    postError(message.id, error);
  }
}

async function handleMessage(
  message: Exclude<WorkerRequest, { type: "analyze" } | { type: "cancelLoad" }>,
): Promise<void> {
  try {
    if (message.type === "load") {
      const data = await fetchJson<HrasIndex>(message.url);
      if (message.id !== latestLoadId) return;
      const nextIndex = buildIndex(data, message.sampleScope);
      if (message.id !== latestLoadId) return;
      resetSliceAnalysisCaches();
      index = nextIndex;
      post({
        id: message.id,
        type: "load",
        index: summarizeIndex(index),
      });
      return;
    }

    const value = ensureIndex();

    if (message.type === "signatureOptions") {
      post({
        id: message.id,
        type: "signatureOptions",
        options: signatureOptionsForQuery(value, message.query),
      });
      return;
    }

    if (message.type === "subcladeProfile") {
      post({
        id: message.id,
        type: "subcladeProfile",
        profile: annotateProfile(value, subcladeProfileForClade(value, message.clade, message.countries)),
      });
      return;
    }

    if (message.type === "countryEvidence") {
      post({
        id: message.id,
        type: "countryEvidence",
        evidence: annotateCountry(value, countryEvidenceForBranch(value, message.country, message.anchorId)),
        profile: annotateProfile(value, subcladeProfileForClade(value, message.anchorId)),
      });
      return;
    }

    if (message.type === "countryOverview") {
      post({
        id: message.id,
        type: "countryOverview",
        overview: annotateOverview(value, countryOverviewForCountry(value, message.country, message.countries)),
      });
      return;
    }

  } catch (error) {
    postError(message.id, error);
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const payload = await response.text();
  try {
    return JSON.parse(payload) as T;
  } catch (error) {
    const received = payload.trimStart().startsWith("<")
      ? "HTML"
      : response.headers.get("content-type") ?? "an unknown response type";
    throw new Error(
      `Runtime dataset request returned ${received} instead of JSON: ${response.url || url}`,
      { cause: error },
    );
  }
}

function ensureIndex(): TreeIndex {
  if (!index) throw new Error("Index is not loaded.");
  return index;
}

function postError(id: number, error: unknown): void {
  post({
    id,
    type: "error",
    message: error instanceof Error ? error.message : String(error),
  });
}

function post(message: WorkerResponse): void {
  self.postMessage(message);
}

export {};
