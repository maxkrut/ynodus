import { expect, type Locator, type Page } from "@playwright/test";

type ContrastSample = { name: string; control: Locator; text?: Locator };
type ContrastReading = { ratio: number; minimum: number; foreground: string; background: number[] };

// Deliberately scoped to visible text on solid sRGB surfaces. Unsupported paint
// fails instead of producing a guessed ratio or silently dropping a sample.
export async function readTextContrast(text: Locator): Promise<ContrastReading> {
  return text.evaluate((element) => {
    type Color = [number, number, number, number];
    const parse = (value: string): Color => {
      const match = /^rgba?\(([^)]+)\)$/.exec(value);
      if (!match) throw new Error(`Unsupported contrast color: ${value}`);
      const channels = match[1].split(/[,\s/]+/).map(Number);
      if ((channels.length !== 3 && channels.length !== 4) || channels.some((n) => !Number.isFinite(n))) {
        throw new Error(`Unsupported contrast color: ${value}`);
      }
      return [channels[0], channels[1], channels[2], channels[3] ?? 1];
    };
    const over = (foreground: Color, background: Color): Color => {
      const alpha = foreground[3] + background[3] * (1 - foreground[3]);
      if (alpha === 0) return [0, 0, 0, 0];
      return [0, 1, 2].map((i) => (
        (foreground[i] * foreground[3] + background[i] * background[3] * (1 - foreground[3])) / alpha
      )).concat(alpha) as Color;
    };
    const luminance = (color: Color): number => {
      const linear = color.slice(0, 3).map((value) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    };
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height || style.visibility !== "visible" || element.closest("[hidden], [inert]")) {
      throw new Error("Contrast sample is not visible");
    }
    if (element.closest(":disabled, [aria-disabled='true']")) {
      throw new Error("Contrast sample is disabled; choose an enabled state explicitly");
    }
    const input = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
    const select = element instanceof HTMLSelectElement;
    const hasText = input ? element.value.trim() : select ? element.selectedOptions[0]?.textContent?.trim()
      : [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
    if (!hasText) throw new Error("Contrast sample needs direct text or a populated form value");

    let background: Color = [0, 0, 0, 0];
    for (let node: Element | null = element; node; node = node.parentElement) {
      const paint = getComputedStyle(node);
      if (paint.opacity !== "1" || paint.filter !== "none" || paint.backdropFilter !== "none"
        || paint.mixBlendMode !== "normal" || paint.clipPath !== "none" || paint.textShadow !== "none") {
        throw new Error("Unsupported contrast paint: opacity, filter, blend, clipping or text shadow");
      }
      // A pseudo-element can cover a solid background; do not guess its geometry.
      for (const pseudo of ["::before", "::after"]) {
        const content = getComputedStyle(node, pseudo).content;
        if (content !== "none" && content !== "normal") throw new Error("Unsupported contrast paint: pseudo-element");
      }
      if (background[3] < 1) {
        if (paint.backgroundImage !== "none") throw new Error("Unsupported contrast paint: background image");
        background = over(background, parse(paint.backgroundColor));
      }
    }
    if (background[3] < 1) throw new Error("Contrast sample has no explicit opaque background");
    const foreground = parse(style.color);
    const fill = style.getPropertyValue("-webkit-text-fill-color");
    if (fill && fill !== style.color) throw new Error("Unsupported contrast paint: text fill override");
    const a = luminance(over(foreground, background));
    const b = luminance(background);
    const fontSize = Number.parseFloat(style.fontSize);
    const bold = Number.parseFloat(style.fontWeight) >= 700;
    const minimum = fontSize >= 24 || (fontSize >= 14 * 96 / 72 && bold) ? 3 : 4.5;
    return { ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), minimum,
      foreground: style.color, background: background.slice(0, 3) };
  });
}

export async function measureTextStates(page: Page, samples: ContrastSample[]) {
  if (!samples.length) throw new Error("Contrast scope must contain at least one sample");
  const readings: (ContrastReading & { name: string; state: string })[] = [];
  // Measure settled states, not arbitrary points along a transition.
  const style = await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; animation: none !important; }" });
  try {
    for (const { name, control, text = control } of samples) {
      await expect(control, name).toHaveCount(1);
      await expect(control, name).toBeVisible();
      await expect(control, name).toBeEnabled();
      await expect(text, name).toHaveCount(1);
      await expect(text, name).toBeVisible();
      for (const state of ["default", "hover", "focus"] as const) {
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        await control.scrollIntoViewIfNeeded();
        await page.mouse.move(0, 0);
        if (state === "hover") {
          await control.hover();
          await expect.poll(() => control.evaluate((node) => node.matches(":hover")), { message: name }).toBe(true);
        } else if (state === "focus") {
          // Arrive through Tab to exercise :focus-visible as well as :focus.
          // A local entry point avoids browser chrome and contextual source links.
          const entry = await control.evaluateHandle(node => {
            const marker = document.createElement("span");
            marker.tabIndex = 0;
            marker.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden";
            // Summary must remain the first child of details to retain native keyboard behavior.
            const before = node.tagName === "SUMMARY" && node.parentElement?.tagName === "DETAILS"
              ? node.parentElement : node;
            before.before(marker); marker.focus();
            return marker;
          });
          try {
            await page.keyboard.press("Tab");
            await expect(control, name).toBeFocused();
            await expect.poll(() => control.evaluate((node) => node.matches(":focus-visible")), { message: name }).toBe(true);
          } finally {
            await entry.evaluate(node => node.remove());
            await entry.dispose();
          }
        } else {
          await expect.poll(() => control.evaluate((node) => node.matches(":hover, :focus")), { message: name }).toBe(false);
        }
        readings.push({ name, state, ...await readTextContrast(text) });
      }
    }
  } finally {
    await style.evaluate((node) => node.parentNode?.removeChild(node));
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.mouse.move(0, 0);
  }
  expect(readings).toHaveLength(samples.length * 3);
  return readings;
}

export function expectReadableText(readings: Awaited<ReturnType<typeof measureTextStates>>) {
  expect(readings.length, "No text contrast measurements").toBeGreaterThan(0);
  for (const reading of readings) {
    expect(reading.ratio, `${reading.name} / ${reading.state}: ${reading.ratio.toFixed(3)}:1; `
      + `${reading.foreground} on rgb(${reading.background.join(", ")}); need ${reading.minimum}:1`)
      .toBeGreaterThanOrEqual(reading.minimum);
  }
}
