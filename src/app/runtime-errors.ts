import type { TextKey } from "./i18n";

type RuntimeErrorPhase = "load" | "analysis" | "research";

export function runtimeErrorSummary(
  detail: string,
  t: (key: TextKey) => string,
  phase: RuntimeErrorPhase,
): string {
  const normalized = detail.toLowerCase();
  if (
    normalized.includes("<!doctype") ||
    normalized.includes("text/html") ||
    normalized.includes("unexpected token '<'") ||
    normalized.includes("returned html")
  ) {
    return t("runtimeErrorHtml");
  }
  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("networkerror") ||
    normalized.includes("network request")
  ) {
    return t("runtimeErrorNetwork");
  }
  if (
    normalized.includes("invalid hras index") ||
    normalized.includes("unsupported hras index") ||
    normalized.includes("not valid json") ||
    normalized.includes("json")
  ) {
    return t("runtimeErrorInvalidData");
  }
  if (phase === "analysis") return t("runtimeErrorAnalysis");
  if (phase === "research") return t("runtimeErrorResearch");
  return t("runtimeErrorLoad");
}
