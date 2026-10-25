// Light, pastel end of ColorBrewer Blues (the first 4 of 9 colours), available in ggplot2:
// https://github.com/axismaps/colorbrewer/blob/master/colorbrewer_schemes.js
const BLUES = ["F7FBFF", "DEEBF7", "C6DBEF", "9ECAE1"]
  .map(hex => [0,2,4].map(offset => parseInt(hex.slice(offset,offset+2),16)));

/** One logarithmic count scale for the complete branch, independent of paging/filtering. */
export function matrixCountPaint(count: number, maximum: number): { background: string; foreground: string } {
  if (count <= 0) return { background: "transparent", foreground: "#596b73" };
  const fraction = maximum <= 1 ? .5 : Math.max(0,Math.min(1,Math.log(count)/Math.log(maximum)));
  const position = fraction * (BLUES.length-1), index = Math.min(BLUES.length-2,Math.floor(position));
  const rgb = BLUES[index].map((channel,i) => Math.round(channel+(BLUES[index+1][i]-channel)*(position-index)));
  const linear = rgb.map(channel => channel/255 <= .04045 ? channel/255/12.92 : ((channel/255+.055)/1.055)**2.4);
  const luminance = .2126*linear[0]+.7152*linear[1]+.0722*linear[2];
  const whiteContrast = 1.05/(luminance+.05), blackContrast = (luminance+.05)/.05;
  return { background: `rgb(${rgb.join(",")})`, foreground: whiteContrast > blackContrast ? "#ffffff" : "#000000" };
}
