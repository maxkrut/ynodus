/** Explicit preset details stay inside the country picker and never open on hover. */
export function bindPresetTooltips(root: HTMLElement): void {
  let active: HTMLElement | null = null;

  function close(restoreFocus = false, previous = active): void {
    active = null;
    previous?.classList.remove("card-open");
    const trigger = previous?.querySelector<HTMLButtonElement>("[data-preset-info]");
    trigger?.setAttribute("aria-expanded", "false");
    if (restoreFocus && trigger?.isConnected) trigger.focus();
  }

  function place(): void {
    if (!active?.isConnected) { close(); return; }
    const trigger = active.querySelector<HTMLElement>("[data-preset-info]");
    const card = active.querySelector<HTMLElement>(".preset-members-tooltip");
    const dialog = active.closest("dialog");
    if (!trigger || !card || !dialog?.open) return;
    const anchor = trigger.getBoundingClientRect();
    const surface = dialog.getBoundingClientRect();
    const scale = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
    const top = Math.max(8, surface.top + 8);
    const bottom = Math.min(innerHeight - 8, surface.bottom - 8);
    const left = Math.max(8, surface.left + 8);
    const right = Math.min(innerWidth - 8, surface.right - 8);
    card.style.width = `${Math.min(430 * scale, right - left) / scale}px`;
    card.style.maxHeight = `${Math.min(500 * scale, bottom - top) / scale}px`;
    const width = card.getBoundingClientRect().width;
    const height = card.getBoundingClientRect().height;
    const preferredLeft = anchor.right + 8 + width <= right ? anchor.right + 8 : anchor.left - width - 8;
    card.style.left = `${Math.max(left, Math.min(preferredLeft, right - width)) / scale}px`;
    card.style.top = `${Math.max(top, Math.min(anchor.top, bottom - height)) / scale}px`;
  }

  function revealFocusedControl(): void {
    const card = active?.querySelector<HTMLElement>(".preset-members-tooltip");
    const focused = document.activeElement;
    if (card && focused instanceof HTMLElement && focused !== card && card.contains(focused)) {
      const viewport = card.getBoundingClientRect();
      const control = focused.getBoundingClientRect();
      const scale = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
      // Positioning after native focus scrolling can clip a wrapped source link.
      if (control.bottom > viewport.bottom - 4) card.scrollTop += (control.bottom - viewport.bottom + 4) / scale;
      else if (control.top < viewport.top + 4) card.scrollTop -= (viewport.top + 4 - control.top) / scale;
    }
  }

  root.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const closeButton = target?.closest<HTMLElement>("[data-preset-card-close]");
    if (closeButton) {
      // Pointer focus may already have dismissed the card before click dispatch.
      close(true, closeButton.closest<HTMLElement>(".preset-option-wrap"));
      return;
    }
    const trigger = target?.closest<HTMLButtonElement>("[data-preset-info]");
    if (!trigger || !root.contains(trigger)) return;
    const wrap = trigger.closest<HTMLElement>(".preset-option-wrap");
    if (!wrap) return;
    if (active === wrap) { close(); return; }
    close();
    active = wrap;
    active.classList.add("card-open");
    trigger.setAttribute("aria-expanded", "true");
    // WebKit pointer clicks need not focus buttons. Escape must belong to this card.
    trigger.focus({ preventScroll: true });
    place();
  });
  root.addEventListener("mousedown", (event) => {
    if (event.target instanceof HTMLElement && event.target.closest("[data-preset-card-close]")) {
      // Cancel mouse focus (including touch compatibility events), not pointerdown:
      // WebKit otherwise dismisses the card early, or suppresses the touch click.
      event.preventDefault();
    }
  });
  document.addEventListener("pointerdown", (event) => {
    if (active && event.target instanceof Node && !active.contains(event.target)) close();
  });
  document.addEventListener("focusin", (event) => {
    if (active && event.target instanceof Node && !active.contains(event.target)) close();
    else if (active) requestAnimationFrame(() => { place(); revealFocusedControl(); });
  });
  root.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !active) return;
    close(true);
    event.preventDefault();
    event.stopPropagation();
  });
  root.closest("dialog")?.addEventListener("close", () => close());
  root.closest("dialog")?.addEventListener("scroll", place, true);
  window.addEventListener("resize", () => { place(); revealFocusedControl(); });
}
