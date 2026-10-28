/**
 * Categorical colours for the charts: eight hues in a fixed order, each stepped for its own surface.
 * Light and dark are separate selections, not a flip. The order is what keeps neighbouring series
 * apart under colour-vision deficiency: both runs pass the dataviz validator on the adjacent pair list
 * (worst CVD Delta E 9.1 light, 8.4 dark; normal vision 19.6 and 19.3), so never re-order, and never
 * generate a ninth hue: fold the tail into "Other" instead.
 */
export const CATEGORICAL_LIGHT = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#6250d6",
  "#e34948",
] as const;

export const CATEGORICAL_DARK = [
  "#3987e5",
  "#d95926",
  "#199e70",
  "#c98500",
  "#d55181",
  "#008300",
  "#9085e9",
  "#e66767",
] as const;

/** The neutral the folded tail ("Other") is drawn in: it is not an entity, so it gets no hue. */
export const OTHER_COLOR = "#898781";

export const PALETTE_SIZE = CATEGORICAL_LIGHT.length;

/** CSS variable carrying slot `index`; `feedback-chart.css` defines the eight per theme. */
export const seriesColorVar = (index: number): string => `var(--fbc-s${(index % PALETTE_SIZE) + 1})`;

export const otherColorVar = "var(--fbc-other)";

const channel = (value: number): number => {
  const scaled = value / 255;
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string): number => {
  const value = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((value >> 16) & 255) +
    0.7152 * channel((value >> 8) & 255) +
    0.0722 * channel(value & 255)
  );
};

export const contrastRatio = (a: string, b: string): number => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

/**
 * White or near-black for a label set inside a coloured slice: white while it holds 4:1, otherwise
 * whichever of the two reads better (the lighter hues need the dark ink).
 */
export const labelColorOn = (fill: string): string => {
  const white = contrastRatio(fill, "#ffffff");
  if (white >= 4) return "#ffffff";
  return white >= contrastRatio(fill, "#0b0b0b") ? "#ffffff" : "#0b0b0b";
};

export const paletteFor = (theme: "light" | "dark"): readonly string[] =>
  theme === "dark" ? CATEGORICAL_DARK : CATEGORICAL_LIGHT;
