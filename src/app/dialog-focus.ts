const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const navigationClosures = new WeakSet<HTMLDialogElement>();

/** A route owns the new focus; delayed native close events must not steal it. */
export function closeDialogsForNavigation(): void {
  for (const dialog of document.querySelectorAll<HTMLDialogElement>("dialog[open]")) {
    navigationClosures.add(dialog);
    dialog.close();
  }
}

export function restoreDialogFocus(dialog: HTMLDialogElement, target: HTMLElement | null): void {
  if (navigationClosures.delete(dialog)) return;
  target?.focus();
}

export function trapDialogTab(
  event: KeyboardEvent,
  dialog: HTMLDialogElement,
): void {
  if (event.key !== "Tab" || !dialog.open) return;

  const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
    .filter(isAvailableInTabOrder);
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!first || !last) {
    event.preventDefault();
    return;
  }

  const active = document.activeElement;
  if (event.shiftKey && (active === first || !dialog.contains(active))) {
    event.preventDefault();
    last.focus();
    return;
  }
  if (!event.shiftKey && (active === last || !dialog.contains(active))) {
    event.preventDefault();
    first.focus();
  }
}

function isAvailableInTabOrder(element: HTMLElement): boolean {
  if (element.getClientRects().length === 0 || element.getAttribute("aria-hidden") === "true") {
    return false;
  }
  if (element.closest("[inert]")) return false;

  const closedDetails = element.closest<HTMLDetailsElement>("details:not([open])");
  if (!closedDetails) return true;
  return element.tagName === "SUMMARY" && element.parentElement === closedDetails;
}
