// Shared color utilities used by both the web app and the survey renderer. Kept in
// `@formbricks/types` (a dependency of both) so the WCAG/contrast math lives in one place
// instead of being duplicated per package.
//
// NOTE: runtime color math living in a package named for types is a pragmatic exception, not a
// pattern — `@formbricks/types` happens to be the only shared dependency between `apps/web` and
// `packages/surveys`. If more shared runtime utilities appear, extract them into a dedicated
// `packages/utils` package (like `i18n-utils`) instead of growing this one.

// Normalizes every hex form `ZColor` accepts (#RGB, #RGBA, #RRGGBB, #RRGGBBAA, with or without
// the leading "#") to lowercase #rrggbb, dropping any alpha channel. Returns undefined for
// anything else. Centralized so the parsers below never throw on persisted styling values.
const normalizeHex = (color: string): string | undefined => {
  const hex = color.startsWith("#") ? color.slice(1) : color;
  if (!/^[a-f\d]+$/i.test(hex)) return undefined;

  // Shorthand (#RGB / #RGBA): expand each channel digit; ignore the alpha digit.
  if (hex.length === 3 || hex.length === 4) {
    const [r, g, b] = hex;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  // Full form (#RRGGBB / #RRGGBBAA): strip the alpha byte.
  if (hex.length === 6 || hex.length === 8) {
    return `#${hex.slice(0, 6)}`.toLowerCase();
  }
  return undefined;
};

export const hexToRGBA = (hex: string | undefined, opacity: number): string | undefined => {
  // return undefined if hex is undefined, this is important for adding the default values to the CSS variables
  // TODO: find a better way to handle this
  if (!hex || hex === "") return undefined;

  const fullHex = normalizeHex(hex);
  if (!fullHex) return "";

  const r = parseInt(fullHex.slice(1, 3), 16);
  const g = parseInt(fullHex.slice(3, 5), 16);
  const b = parseInt(fullHex.slice(5, 7), 16);

  return `rgba(${r.toString()}, ${g.toString()}, ${b.toString()}, ${opacity.toString()})`;
};

export const mixColor = (hexColor: string, mixWithHex: string, weight: number): string => {
  // Convert both colors to RGBA format
  const color1 = hexToRGBA(hexColor, 1) ?? "";
  const color2 = hexToRGBA(mixWithHex, 1) ?? "";

  // Extract RGBA values
  const [r1, g1, b1] = color1.match(/\d+/g)?.map(Number) ?? [0, 0, 0];
  const [r2, g2, b2] = color2.match(/\d+/g)?.map(Number) ?? [0, 0, 0];

  // Mix the colors
  const r = Math.round(r1 * (1 - weight) + r2 * weight);
  const g = Math.round(g1 * (1 - weight) + g2 * weight);
  const b = Math.round(b1 * (1 - weight) + b2 * weight);

  const toHex = (channel: number): string => channel.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export const isLight = (color: string): boolean => {
  // Tolerate every hex form `ZColor` accepts (incl. 4/8-digit with alpha) — persisted styling
  // (e.g. via the management API) reaches this at render time, where throwing would take the
  // whole survey down.
  const hex = normalizeHex(color);
  if (!hex) {
    throw new Error("Invalid color");
  }

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

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
