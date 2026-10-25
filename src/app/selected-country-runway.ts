/** Fill the available first row before disclosing the remaining selected countries. */
export function bindSelectedCountryRunway(
  host: HTMLElement,
  moreLabel: (count: number) => string,
): () => void {
  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(layout);
  };
  function layout(): void {
    const row = host.querySelector<HTMLElement>(".selected-chips");
    const details = row?.querySelector<HTMLDetailsElement>(".selected-more");
    const popover = details?.querySelector<HTMLElement>(".chip-popover");
    const label = details?.querySelector<HTMLElement>(".disclosure-more");
    if (!row || !details || !popover || !label || !row.clientWidth || details.open) return;
    const chips = [...row.querySelectorAll<HTMLElement>(".selected-chip")];
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
    details.hidden = false;
    // Measure existing nodes, preserving their order and remove-button handlers.
    for (const chip of chips) row.insertBefore(chip, details);
    const widths = chips.map(chip => chip.offsetWidth);
    const total = widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, chips.length - 1);
    if (total <= row.clientWidth) { details.hidden = true; return; }
    let visible = 0;
    for (let pass = 0; pass < 2; pass++) {
      label.textContent = moreLabel(chips.length - visible);
      const available = row.clientWidth - details.offsetWidth - gap;
      let used = 0;
      visible = 0;
      for (const width of widths) {
        const next = used + (visible ? gap : 0) + width;
        if (next > available) break;
        used = next;
        visible++;
      }
    }
    label.textContent = moreLabel(chips.length - visible);
    for (const chip of chips.slice(visible)) popover.append(chip);
  }
  let lastWidth = -1;
  new ResizeObserver(entries => {
    const width = entries[0]?.contentRect.width ?? 0;
    if (width === lastWidth) return;
    lastWidth = width;
    schedule();
  }).observe(host);
  host.addEventListener("toggle", schedule, true);
  return schedule;
}
