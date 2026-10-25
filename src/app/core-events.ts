import { downloadResultsCsv } from "./export-csv";
import type { AppEventBindings } from "./event-bindings";
import { restoreDialogFocus, trapDialogTab } from "./dialog-focus";
import { filterRowsByMacroGroup } from "./result-filter";
import { compareRowsByTableSort, tableSortForMode } from "../results/sorting";
import { saveLocalePreference } from "./locale-preference";

export function bindCoreActions({
  state,
  elements,
  formatCalendar,
  subcladeUrl,
}: AppEventBindings): void {
  const { exportButton } = elements;
  document.getElementById("query-results-jump")?.addEventListener("click", () => {
    elements.resultsRoot.scrollIntoView({ block: "start" });
    document.getElementById("result-title")?.focus({ preventScroll: true });
  });
  exportButton.addEventListener("click", () => {
    const query = state.committedQuery;
    if (
      state.analysisBusy
      || (state.results.length === 0 && state.crossingResults.length === 0)
      || !query
    ) return;
    const formedSort = tableSortForMode(state.tableSort, "formed");
    const crossingSort = tableSortForMode(state.crossingTableSort, "crossing");
    downloadResultsCsv({
      formedRows: filterRowsByMacroGroup(state.results, state.resultMacroGroup)
        .sort((a, b) => compareRowsByTableSort(a, b, formedSort)),
      crossingRows: query.includeCrossing
        ? filterRowsByMacroGroup(state.crossingResults, state.crossingMacroGroup)
          .sort((a, b) => compareRowsByTableSort(a, b, crossingSort))
        : [],
      selectedCountries: query.selectedCountries,
      presenceMode: query.presenceMode,
      minResultSamples: query.minResultSamples,
      maxDeltaYbp: query.maxDeltaYbp,
      includeCrossing: query.includeCrossing,
      provenance: query.provenance,
      targetYbp: query.targetYbp,
      targetYear: query.targetYear,
      targetEra: query.targetEra,
      macroGroupFilter: state.resultMacroGroup,
      crossingMacroGroupFilter: state.crossingMacroGroup,
      formatCalendar,
      subcladeUrl,
    });
  });
  bindMockupPageControls(elements);
}

function bindMockupPageControls(
  elements: AppEventBindings["elements"],
): void {
  const openDialog = (dialog: HTMLDialogElement): void => {
    if (dialog.open) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  };
  const closeDialog = (dialog: HTMLDialogElement): void => {
    if (!dialog.open && !dialog.hasAttribute("open")) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  };

  const bindPickerDialog = (
    triggers: Iterable<HTMLButtonElement>,
    dialog: HTMLDialogElement,
    closeButtons: readonly HTMLButtonElement[],
    initialFocus: HTMLElement,
  ): void => {
    const triggerList = [...triggers];
    let activeTrigger = triggerList[0];
    triggerList.forEach((trigger) => {
      trigger.addEventListener("click", () => {
        activeTrigger = trigger;
        openDialog(dialog);
        triggerList.forEach((item) => item.setAttribute(
          "aria-expanded",
          item === trigger ? "true" : "false",
        ));
        queueMicrotask(() => initialFocus.focus());
      });
    });
    closeButtons.forEach((button) => {
      button.addEventListener("click", () => closeDialog(dialog));
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog(dialog);
    });
    dialog.addEventListener("keydown", (event) => {
      trapDialogTab(event, dialog);
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeDialog(dialog);
    });
    dialog.addEventListener("close", () => {
      triggerList.forEach((trigger) => trigger.setAttribute("aria-expanded", "false"));
      if (activeTrigger) restoreDialogFocus(dialog, activeTrigger);
    });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeDialog(dialog);
    });
  };

  bindPickerDialog(
    [elements.selectionPanelToggle],
    elements.selectionPanel,
    [elements.selectionPanelClose, elements.selectionPanelDone],
    elements.countrySearch,
  );
}

export function bindLocaleEvents({ state, elements, applyLocale }: AppEventBindings): void {
  elements.localeSwitcher.addEventListener("change", () => {
    const locale = elements.localeSwitcher.value;
    if (locale !== "en" && locale !== "ru") return;
    saveLocalePreference(locale);
    state.locale = locale;
    applyLocale();
  });
}
