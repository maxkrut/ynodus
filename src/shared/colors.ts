import { groupFillColor } from "./group-palette";

const TREE_TEXT_BACKGROUND = "#fffefc";
// Leave a small rendering/background margin above the 4.5:1 AA threshold.
const NORMAL_TEXT_MIN_CONTRAST = 4.7;

export function groupColor(project: string): string {
  const paletteColor = groupFillColor(project);
  // Text uses a darker shade of the same fill used by chart and table markers.
  // Darken light palette entries until normal-size text reaches WCAG AA
  // against the opaque card background.
  return colorAtMinimumContrast(paletteColor, TREE_TEXT_BACKGROUND, NORMAL_TEXT_MIN_CONTRAST);
}

export function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  if (foregroundLuminance === null || backgroundLuminance === null) return 1;
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function colorAtMinimumContrast(color: string, background: string, minimum: number): string {
  if (contrastRatio(color, background) >= minimum) return color;
  const channels = hexChannels(color);
  if (!channels) return "#4f5e5a";

  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 16; iteration += 1) {
    const scale = (low + high) / 2;
    const candidate = channelsToHex(channels.map((channel) => channel * scale));
    if (contrastRatio(candidate, background) >= minimum) low = scale;
    else high = scale;
  }
  return channelsToHex(channels.map((channel) => channel * low));
}

function relativeLuminance(color: string): number | null {
  const channels = hexChannels(color);
  if (!channels) return null;
  const linear = channels
    .map((channel) => channel / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function hexChannels(color: string): [number, number, number] | null {
  const normalized = color.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
  return [0, 2, 4].map(
    (offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16),
  ) as [number, number, number];
}

function channelsToHex(channels: number[]): string {
  return `#${channels
    .map((channel) => Math.max(0, Math.min(255, Math.floor(channel))).toString(16).padStart(2, "0"))
    .join("")}`;
}
