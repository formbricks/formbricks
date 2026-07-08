// Shared color utilities used by both the web app and the survey renderer. Kept in
// `@formbricks/types` (a dependency of both) so the WCAG/contrast math lives in one place
// instead of being duplicated per package.

export const hexToRGBA = (hex: string | undefined, opacity: number): string | undefined => {
  // return undefined if hex is undefined, this is important for adding the default values to the CSS variables
  // TODO: find a better way to handle this
  if (!hex || hex === "") return undefined;

  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  let shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);

  let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "";

  let r = parseInt(result[1], 16);
  let g = parseInt(result[2], 16);
  let b = parseInt(result[3], 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

export const mixColor = (hexColor: string, mixWithHex: string, weight: number): string => {
  // Convert both colors to RGBA format
  const color1 = hexToRGBA(hexColor, 1) || "";
  const color2 = hexToRGBA(mixWithHex, 1) || "";

  // Extract RGBA values
  const [r1, g1, b1] = color1.match(/\d+/g)?.map(Number) || [0, 0, 0];
  const [r2, g2, b2] = color2.match(/\d+/g)?.map(Number) || [0, 0, 0];

  // Mix the colors
  const r = Math.round(r1 * (1 - weight) + r2 * weight);
  const g = Math.round(g1 * (1 - weight) + g2 * weight);
  const b = Math.round(b1 * (1 - weight) + b2 * weight);

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

export const isLight = (color: string) => {
  let r: number | undefined, g: number | undefined, b: number | undefined;

  if (color.length === 4) {
    r = parseInt(color[1] + color[1], 16);
    g = parseInt(color[2] + color[2], 16);
    b = parseInt(color[3] + color[3], 16);
  } else if (color.length === 7) {
    r = parseInt(color[1] + color[2], 16);
    g = parseInt(color[3] + color[4], 16);
    b = parseInt(color[5] + color[6], 16);
  }
  if (r === undefined || g === undefined || b === undefined) {
    throw new Error("Invalid color");
  }
  return r * 0.299 + g * 0.587 + b * 0.114 > 128;
};

// WCAG 2.x relative luminance of an sRGB hex color (0 = black, 1 = white).
// https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
export const getRelativeLuminance = (hex: string): number => {
  const rgba = hexToRGBA(hex, 1);
  if (!rgba) return 0;

  const [r, g, b] = rgba.match(/\d+/g)?.map(Number) ?? [0, 0, 0];

  const toLinear = (channel8bit: number): number => {
    const channel = channel8bit / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
};

// WCAG 2.x contrast ratio between two hex colors, ranging from 1:1 to 21:1.
// AA requires >= 4.5 for normal text and >= 3 for large text/non-text.
export const getContrastRatio = (colorA: string, colorB: string): number => {
  const luminanceA = getRelativeLuminance(colorA);
  const luminanceB = getRelativeLuminance(colorB);
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
};

// WCAG AA contrast threshold for normal-size text.
export const AA_CONTRAST_RATIO = 4.5;

// Picks a text color that clears `minRatio` against `surface`. Prefers the higher-contrast of
// the two soft candidates (slate-900 / white) for a less harsh look, but escalates to the pure
// black/white pole when a soft tone falls short — one pure pole always clears AA (~4.58:1 worst
// case), so the result is guaranteed accessible for any surface.
export const getReadableTextColor = (
  surface: string,
  darkText = "#0f172a",
  lightText = "#ffffff",
  minRatio: number = AA_CONTRAST_RATIO
): string => {
  const soft =
    getContrastRatio(darkText, surface) >= getContrastRatio(lightText, surface) ? darkText : lightText;
  if (getContrastRatio(soft, surface) >= minRatio) return soft;

  return getContrastRatio("#000000", surface) >= getContrastRatio("#ffffff", surface) ? "#000000" : "#ffffff";
};

// Nudges `preferred` toward black (on light surfaces) or white (on dark surfaces) just far
// enough to clear `minRatio` against `surface`, preserving as much of the original hue as
// possible. Falls back to the pure pole, which always clears AA on a near-white/near-black surface.
export const ensureReadable = (
  preferred: string,
  surface: string,
  minRatio: number = AA_CONTRAST_RATIO
): string => {
  if (getContrastRatio(preferred, surface) >= minRatio) return preferred;

  const pole = isLight(surface) ? "#000000" : "#ffffff";
  for (let weight = 0.1; weight < 1; weight += 0.1) {
    const candidate = mixColor(preferred, pole, weight);
    if (getContrastRatio(candidate, surface) >= minRatio) return candidate;
  }
  return pole;
};
