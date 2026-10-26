const layouts = new WeakMap<HTMLElement, string>();
const observed = new WeakSet<HTMLElement>();

/** Keep complete names readable without changing the calendar widths of the bands. */
export function layoutPeriodLabels(axis: HTMLElement): void {
  const strip = axis.querySelector<HTMLElement>(".time-axis-periods");
  if (!strip || typeof getComputedStyle !== "function" || !strip.clientWidth) return;
  const bands = [...strip.querySelectorAll<HTMLElement>("[data-period-band]")];
  const firstLabel = bands[0]?.querySelector<HTMLElement>(".period-band-label");
  if (!firstLabel) return;
  const style = getComputedStyle(firstLabel);
  const signature = [strip.clientWidth, document.fonts.check('600 14px "Roboto Condensed Epochs"'),
    style.font, style.letterSpacing, style.wordSpacing,
    ...bands.map(band => `${band.hidden}:${band.style.left}:${band.style.width}:${band.textContent}`)].join("|");
  // A date drag leaves all period geometry unchanged. Refit only for an actual
  // width, label, font or calendar-boundary change.
  if (layouts.get(strip) === signature) return;
  const width = strip.clientWidth;
  const baseHeight = parseFloat(getComputedStyle(strip).getPropertyValue("--period-base-height")) || 38;
  const rowHeight = Math.max(20, Math.ceil(parseFloat(style.lineHeight) || 18) + 2);
  const gap = 8;
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) return;
  measure.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const letterSpacing = parseFloat(style.letterSpacing) || 0;
  const wordSpacing = parseFloat(style.wordSpacing) || 0;
  const textWidth = (text: string) => measure.measureText(text).width
    + Math.max(0, text.length - 1) * letterSpacing + (text.match(/\s/g)?.length ?? 0) * wordSpacing;
  // Read all text widths before writing positions: moving the date must not cause
  // a separate synchronous layout for every period.
  const entries = bands.flatMap(band => {
    const label = band.querySelector<HTMLElement>(".period-band-label");
    if (!label || band.hidden) return [];
    const text = label.textContent || "";
    const words = text.split(/\s+/);
    const twoLineWidth = words.slice(1).reduce((best, _, index) => Math.min(best,
      Math.max(textWidth(words.slice(0, index + 1).join(" ")), textWidth(words.slice(index + 1).join(" ")))), textWidth(text));
    const bandWidth = parseFloat(band.style.width) * width / 100;
    const internal = band.dataset.periodBand === "medieval" || band.dataset.periodBand === "modern";
    const labelStyle = getComputedStyle(label);
    const lineRatio = parseFloat(labelStyle.lineHeight) / parseFloat(labelStyle.fontSize) || 1.05;
    const fontSize = Math.min(14, 14 * Math.max(1, bandWidth - 5) / twoLineWidth);
    const labelWidth = Math.ceil(textWidth(text)) + 8;
    const outside = internal ? fontSize < 11 : labelWidth + gap > bandWidth;
    return [{ band, label, left: parseFloat(band.style.left) * width / 100, bandWidth,
      labelWidth, internal, outside, fontSize: outside ? 14 : fontSize,
      insetHeight: internal && !outside ? 2 * fontSize * lineRatio + 4 : 0 }];
  });
  const bandHeight = Math.ceil(Math.max(baseHeight, ...entries.map(entry => entry.insetHeight)));
  strip.style.setProperty("--period-band-height", `${bandHeight}px`);
  const lanes: number[] = [];
  for (const { band, label, left, bandWidth, labelWidth, internal, outside, fontSize } of entries) {
    band.classList.toggle("has-period-callout", outside);
    band.classList.toggle("has-period-inset", internal && !outside);
    label.style.setProperty("--period-label-size", `${fontSize}px`);
    if (!outside) {
      label.style.width = "";
      label.style.left = "50%";
      label.style.top = "0px";
      continue;
    }
    const labelLeft = Math.max(0, Math.min(width - labelWidth, left + bandWidth / 2 - labelWidth / 2));
    // Bound callouts to the measured strip even when custom text spacing grows
    // their content after layout. They can wrap rather than widen the page.
    label.style.width = `${Math.min(labelWidth, width - labelLeft)}px`;
    let lane = lanes.findIndex(right => right + gap <= labelLeft);
    if (lane < 0) lane = lanes.length;
    lanes[lane] = labelLeft + labelWidth;
    const top = bandHeight + 6 + lane * rowHeight;
    label.style.left = `${labelLeft - left}px`;
    label.style.top = `${top}px`;
    band.style.setProperty("--period-leader-height", `${top - bandHeight}px`);
  }
  strip.style.height = `${bandHeight + 2 + (lanes.length ? 6 + lanes.length * rowHeight : 0)}px`;
  layouts.set(strip, signature);
  if (typeof ResizeObserver !== "undefined" && !observed.has(strip)) {
    observed.add(strip);
    const observer = new ResizeObserver(() => layoutPeriodLabels(axis));
    bands.forEach(band => {
      const label = band.querySelector(".period-band-label");
      if (label) observer.observe(label);
    });
  }
}
