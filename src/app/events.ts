import { bindCoreActions, bindLocaleEvents } from "./core-events";
import { bindCountryEvents } from "./country-events";
import type { AppEventBindings } from "./event-bindings";
import { bindResultEvents } from "./result-events";
import { bindResearchEvents } from "./research-events";
import { bindTimeControls } from "./time-events";
import { bindAnnotations } from "./annotations";

export function bindAppEvents(bindings: AppEventBindings): void {
  bindAnnotations(bindings.elements.app, bindings.t);
  bindCoreActions(bindings);
  bindLocaleEvents(bindings);
  bindCountryEvents(bindings);
  bindTimeControls(bindings);
  bindResultEvents(bindings);
  bindResearchEvents(bindings);
}
