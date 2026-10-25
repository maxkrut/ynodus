import { groupProject } from "./haplogroups";

// Classic ggplot2/scales hue palette: h = 15 + 360 * i / 50, c = 100, l = 65.
// https://scales.r-lib.org/reference/pal_hue.html
// Fixed levels keep fills independent of selection, date and interval contents.
// Interleaving hues separates adjacent named groups (including R1a/R1b and I1/I2).
const GROUP_FILL_PALETTE: Record<string, string> = {
  "R1a": "#F8766D",
  "R1b": "#00BE6C",
  "I1": "#CF78FF",
  "I2": "#C59900",
  "J1": "#00BDD0",
  "J2": "#FF62BC",
  "E": "#5BB300",
  "G": "#529EFF",
  "N": "#ED8141",
  "Q": "#00C08D",
  "C": "#E76BF3",
  "D": "#AFA100",
  "O": "#00B8E5",
  "T": "#FF689F",
  "H": "#00B81F",
  "L": "#9590FF",
  "M": "#E08B00",
  "R2": "#00C1AA",
  "S": "#F763E0",
  "A00": "#95A900",
  "A0": "#00B0F6",
  "A0-T": "#FC717F",
  "A": "#00BC59",
  "A1": "#BF80FF",
  "A1a": "#CF9400",
  "A1b1": "#00BFC4",
  "B": "#FF61C9",
  "BT": "#72B000",
  "CF": "#00A5FF",
  "CT": "#F37B59",
  "DE": "#00BF7D",
  "F": "#DC71FA",
  "F-Y27277": "#BB9D00",
  "F1": "#00BBDB",
  "F2": "#FF65AE",
  "F3": "#39B600",
  "GHIJK": "#7997FF",
  "HIJK": "#E7861B",
  "I": "#00C19C",
  "IJ": "#F066EA",
  "IJK": "#A3A500",
  "J": "#00B4EF",
  "K": "#FF6C90",
  "K-Y28299": "#00BA42",
  "K2": "#AC88FF",
  "LT": "#D89000",
  "NO": "#00C0B8",
  "P": "#FC61D5",
  "R": "#85AD00",
  "R1": "#00ABFD",
};

export function groupFillColor(project: string): string {
  return GROUP_FILL_PALETTE[project] ?? GROUP_FILL_PALETTE[groupProject(project)] ?? "#999999";
}
