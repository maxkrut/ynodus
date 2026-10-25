import type { TreeIndexSummary as TreeIndex } from "../shared/types";
import type {
  IndexSummary as WorkerIndexSummary,
  WorkerRequest,
  WorkerRequestPayload,
  WorkerResponse,
} from "../worker/types";

type PendingWorkerRequest = {
  resolve: (response: WorkerResponse) => void;
  reject: (error: Error) => void;
  timeout: number;
  type: WorkerRequestPayload["type"];
};

export type WorkerClient = {
  request: (message: WorkerRequestPayload) => Promise<WorkerResponse>;
};

export function createWorkerClient(worker: Worker, timeoutMs: number): WorkerClient {
  let messageId = 0;
  const requests = new Map<number, PendingWorkerRequest>();

  worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
    const wireResponse = event.data;
    const request = requests.get(wireResponse.id);
    if (!request) return;
    requests.delete(wireResponse.id);
    window.clearTimeout(request.timeout);

    if (wireResponse.type === "error") {
      request.reject(new Error(wireResponse.message));
      return;
    }

    request.resolve(wireResponse);
  });

  worker.addEventListener("error", (event) => {
    failPendingWorkerRequests(requests, new Error(event.message || "Worker failed."));
  });

  worker.addEventListener("messageerror", () => {
    failPendingWorkerRequests(requests, new Error("Worker sent an unreadable response."));
  });

  return {
    request(message: WorkerRequestPayload): Promise<WorkerResponse> {
      supersedePendingRequests(requests, message.type);
      const id = ++messageId;
      const request = { ...message, id } as WorkerRequest;
      return new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          requests.delete(id);
          if (message.type === "load") {
            try {
              worker.postMessage({ id: ++messageId, type: "cancelLoad", loadId: id } satisfies WorkerRequest);
            } catch {
              // The original request still rejects with the timeout that the UI can act on.
            }
          }
          reject(new Error("Worker request timed out."));
        }, timeoutMs);
        requests.set(id, { resolve, reject, timeout, type: message.type });
        try {
          worker.postMessage(request);
        } catch (error) {
          requests.delete(id);
          window.clearTimeout(timeout);
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
    },
  };
}

function supersedePendingRequests(
  requests: Map<number, PendingWorkerRequest>,
  type: WorkerRequestPayload["type"],
): void {
  const supersede = type === "load"
    ? (pendingType: WorkerRequestPayload["type"]) => pendingType === "load" || pendingType === "analyze" || pendingType === "density"
    : type === "analyze" || type === "density"
      ? (pendingType: WorkerRequestPayload["type"]) => pendingType === type
      : () => false;
  for (const [id, request] of requests) {
    if (!supersede(request.type)) continue;
    requests.delete(id);
    window.clearTimeout(request.timeout);
    request.reject(new Error(`Worker ${request.type} request was superseded by a newer request.`));
  }
}

export function normalizeWorkerIndex(index: WorkerIndexSummary): TreeIndex {
  return {
    ...index,
    countries: new Map(index.countries),
  };
}

function failPendingWorkerRequests(requests: Map<number, PendingWorkerRequest>, error: Error): void {
  for (const request of requests.values()) {
    window.clearTimeout(request.timeout);
    request.reject(error);
  }
  requests.clear();
}
