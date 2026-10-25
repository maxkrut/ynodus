import { tooltipContent } from "./popup-content";
import { annotationContent, ANNOTATIONS, type AnnotationId } from "./annotation-markup";
import type { TextKey } from "./i18n";

/** A single contextual note shared by all badges, independent of analysis. */
export function bindAnnotations(root: HTMLElement, t: (key: TextKey) => string): void {
  const panel = root.querySelector<HTMLElement>("#context-annotation")!;
  let active: HTMLElement | null = null;
  let pinned = false;
  let suppressed: HTMLElement | null = null;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  let openTimer: ReturnType<typeof setTimeout> | undefined;
  let pending: HTMLElement | null = null;
  let pointerFocus = false;
  root.addEventListener("pointerdown", () => { pointerFocus = true; }, true);
  // Touch focus can arrive after pointerup but before click. Keep its origin
  // until click so a newly opened note cannot intercept the tap that opens it.
  document.addEventListener("click", () => { pointerFocus = false; }, true);
  document.addEventListener("keydown", () => { pointerFocus = false; }, true);
  document.addEventListener("pointercancel", () => { pointerFocus = false; }, true);
  const trigger = (target: EventTarget | null) => (target as Element | null)?.closest<HTMLElement>("[data-annotation], [data-tooltip], [title]") ?? null;
  const cancelClose = () => { clearTimeout(closeTimer); closeTimer = undefined; };
  const cancelOpen = () => { clearTimeout(openTimer); openTimer = undefined; pending = null; };

  function hide(): void {
    cancelOpen();
    cancelClose();
    if (active?.hasAttribute("data-annotation")) active.setAttribute("aria-expanded", "false");
    if (active) {
      const ids = (active.getAttribute("aria-describedby") || "").split(" ").filter(id => id && id !== panel.id);
      if (ids.length) active.setAttribute("aria-describedby", ids.join(" "));
      else active.removeAttribute("aria-describedby");
    }
    active = null;
    pinned = false;
    panel.hidden = true;
  }
  function position(): void {
    // Scrolling to a hovered control can finish after its opening timer starts.
    // An unrelated scroll must not cancel that pending explanation.
    if (!active) return;
    if (!active.isConnected || !active.getBoundingClientRect().width) { hide(); return; }
    const box = active.getBoundingClientRect();
    const countTop = active.querySelector(".density-count")?.getBoundingClientRect().top ?? box.top;
    const anchorTop = Math.min(box.top, countTop);
    const scale = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
    const margin = Math.max(8, 8 * scale);
    const availableWidth = innerWidth - margin * 2;
    const availableHeight = innerHeight - margin * 2;
    const preferredWidth = panel.classList.contains("periods-annotation") ? 680
      : panel.classList.contains("density-annotation") || panel.classList.contains("header-annotation") ? 500 : 420;
    panel.style.width = `${Math.min(preferredWidth * scale, availableWidth) / scale}px`;
    panel.style.maxHeight = `${availableHeight / scale}px`;
    // Give long notes more width before allowing a small-screen scroll fallback.
    if (innerWidth > 760 && panel.scrollHeight > panel.clientHeight + 1) {
      panel.style.width = `${Math.min(720 * scale, availableWidth) / scale}px`;
    }
    const width = panel.getBoundingClientRect().width;
    const height = panel.getBoundingClientRect().height;
    const below = innerHeight - box.bottom - margin * 2;
    const above = anchorTop - margin * 2;
    let left = Math.max(margin, Math.min(box.left, innerWidth - width - margin));
    let top: number;
    if (height <= below) top = box.bottom + margin;
    else if (height <= above) top = anchorTop - height - margin;
    else {
      if (box.right + width + margin * 2 <= innerWidth) left = box.right + margin;
      else if (box.left >= width + margin * 2) left = box.left - width - margin;
      top = Math.max(margin, Math.min(anchorTop, innerHeight - height - margin));
    }
    panel.style.left = `${left / scale}px`;
    panel.style.top = `${top / scale}px`;
  }
  function show(button: HTMLElement): void {
    if (button === suppressed) return;
    const id = button.dataset.annotation as AnnotationId;
    const isAnnotation = Boolean(id && Object.hasOwn(ANNOTATIONS, id));
    if (id && !isAnnotation) return;
    cancelOpen();
    cancelClose();
    if (active !== button) {
      hide(); active = button;
      const host = button.closest("dialog[open]") || root;
      host.append(panel);
      panel.innerHTML = isAnnotation ? annotationContent(id, t) : tooltipContent(button, t);
      panel.classList.toggle("passive-control-hint", !isAnnotation && !button.matches(".density-cell")
        && !panel.querySelector("a, button, summary"));
      panel.setAttribute("role", isAnnotation ? "note" : "tooltip");
      const headerIds = ["source-sync", "snapshot-notes", "hras-date", "yfull-date", "index-date"];
      panel.classList.toggle("header-annotation", headerIds.includes(id));
      panel.classList.toggle("density-annotation", button.matches(".density-cell"));
      panel.classList.toggle("periods-annotation", id === "periods");
      const facts = panel.querySelector(".annotation-facts-slot")!;
      if (id === "source-sync") facts.innerHTML = (root.querySelector("#source-sync-details")?.innerHTML ?? "") + (root.querySelector("#provenance-notes")?.innerHTML ?? "");
      else if (headerIds.includes(id)) facts.innerHTML = root.querySelector(`#${id}-details`)?.innerHTML ?? "";
    }
    if (isAnnotation) button.setAttribute("aria-expanded", "true");
    else button.setAttribute("aria-describedby", [...new Set([...(button.getAttribute("aria-describedby") || "").split(" ").filter(Boolean), panel.id])].join(" "));
    panel.hidden = false;
    position();
  }
  function scheduleOpen(button: HTMLElement): void {
    cancelClose();
    if (button === active) return;
    if (button === pending) return;
    cancelOpen();
    pending = button;
    openTimer = setTimeout(() => {
      cancelOpen();
      if (root.contains(button) && !button.closest("[hidden], [inert]") && button.matches(":hover")) show(button);
    }, 800);
  }
  function scheduleClose(): void {
    cancelClose();
    closeTimer = setTimeout(() => {
      if (!pinned && !active?.matches(":hover") && !panel.matches(":hover")
        && document.activeElement !== active && !panel.contains(document.activeElement)) hide();
    }, 160);
  }
  root.addEventListener("pointerover", event => {
    if (event.pointerType !== "mouse") return;
    const button = trigger(event.target);
    if (button && (!pinned || button === active)) {
      if (!button.contains(event.relatedTarget as Node | null)) suppressed = null;
      scheduleOpen(button);
    }
    else if (panel.contains(event.target as Node)) cancelClose();
  });
  root.addEventListener("pointerout", event => {
    const button = trigger(event.target);
    if (button?.contains(event.relatedTarget as Node | null)) return;
    if (button === pending) cancelOpen();
    if (button === suppressed && !button?.contains(event.relatedTarget as Node | null)) suppressed = null;
    if (button || panel.contains(event.target as Node)) scheduleClose();
  });
  root.addEventListener("focusin", event => {
    cancelOpen();
    const button = trigger(event.target);
    // Pointer activation opens explicit notes on click; keyboard focus opens now.
    if (button && pointerFocus) {
      if (!button.hasAttribute("data-annotation")) scheduleOpen(button);
    }
    else if (button) show(button);
    else if (panel.contains(event.target as Node)) cancelClose();
    else if (!pinned) hide();
  });
  root.addEventListener("focusout", event => {
    if (trigger(event.target) || panel.contains(event.target as Node)) {
      if (trigger(event.target) === suppressed) suppressed = null;
      scheduleClose();
    }
  });
  document.addEventListener("click", event => {
    cancelOpen();
    const button = trigger(event.target);
    if ((button?.hasAttribute("data-annotation") || button?.hasAttribute("data-tooltip-pin")) && root.contains(button)) {
      if (active === button && pinned) { suppressed = button; hide(); }
      else { suppressed = null; show(button); pinned = true; }
    } else if (!panel.contains(event.target as Node)) { suppressed = button; hide(); }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Tab" && active) {
      const panelControls = [...panel.querySelectorAll<HTMLElement>('a[href], summary')].filter(el => el.getClientRects().length);
      if (panelControls.length && document.activeElement === active && !event.shiftKey) {
        event.preventDefault(); panelControls[0].focus(); return;
      }
      const panelIndex = panelControls.indexOf(document.activeElement as HTMLElement);
      if (panelIndex >= 0) {
        event.preventDefault();
        const adjacent = panelControls[panelIndex + (event.shiftKey ? -1 : 1)];
        if (adjacent) { adjacent.focus(); return; }
        if (event.shiftKey) { active.focus({ preventScroll: true }); return; }
        const controls = [...root.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], summary, [tabindex="0"]')]
          .filter(el => !panel.contains(el) && el.getBoundingClientRect().width && !el.closest("[inert], [hidden]"));
        const next = controls[controls.indexOf(active) + 1];
        hide(); next?.focus(); return;
      }
    }
  });
  // Explicit notes own Escape; passive hints must let their dialog close.
  root.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    cancelOpen();
    if (!active) return;
    if (pinned || active.hasAttribute("data-annotation") || panel.contains(document.activeElement)) {
      event.stopPropagation();
      event.preventDefault();
    }
    const origin = active;
    const restoreFocus = pinned || panel.contains(document.activeElement);
    suppressed = origin;
    hide();
    if (restoreFocus) origin.focus({ preventScroll: true });
  }, true);
  root.querySelector("#locale-switcher")?.addEventListener("change", hide);
  root.addEventListener("close", hide, true);
  new MutationObserver(records => {
    if (!active) return;
    if (!active.isConnected || active.closest("[hidden], [inert]")) { hide(); return; }
    if (!active.hasAttribute("data-annotation") && records.some(record => record.target === active)) {
      panel.innerHTML = tooltipContent(active, t); position();
    }
  }).observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-tooltip", "title", "hidden", "inert"] });
  window.addEventListener("popstate", hide);
  window.addEventListener("resize", position);
  window.addEventListener("scroll", position, true);
  panel.addEventListener("toggle", position, true);
}
