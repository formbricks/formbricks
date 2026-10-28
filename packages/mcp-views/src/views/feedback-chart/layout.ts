/** Geometry decisions for the charts. Pure: sizes in px, no DOM. */

/** Average advance of the system sans, as a share of the font size. Good enough to decide what fits. */
const AVERAGE_GLYPH = 0.56;

export const estimateTextWidth = (text: string, fontSize = 12): number =>
  Math.ceil(text.length * fontSize * AVERAGE_GLYPH);

/** Cut `text` to about `maxWidth` px with an ellipsis; the full text stays in the tooltip and the table. */
export const truncateLabel = (text: string, maxWidth: number, fontSize = 12): string => {
  if (estimateTextWidth(text, fontSize) <= maxWidth) return text;
  const chars = Math.max(1, Math.floor(maxWidth / (fontSize * AVERAGE_GLYPH)) - 1);
  return `${text.slice(0, chars).trimEnd()}…`;
};

export type BarOrientation = "vertical" | "horizontal";

/**
 * Long labels and many categories read horizontally: a column chart would rotate or drop its labels.
 * `plotWidth` is the width a vertical chart would have for its category band.
 */
export const chooseBarOrientation = (labels: readonly string[], plotWidth: number): BarOrientation => {
  if (labels.length === 0) return "vertical";
  const band = plotWidth / labels.length;
  const widest = Math.max(...labels.map((label) => estimateTextWidth(label)));
  return widest > band - 8 ? "horizontal" : "vertical";
};

export interface BandLayout {
  /** Size of one category's slot along the category axis. */
  band: number;
  /** Thickness of a single bar. */
  thickness: number;
  /** Offset of each series' bar from the slot start. */
  offsets: number[];
}

/**
 * Where the bars of each category sit: thin (24px at most, never filling the slot), a 2px surface gap
 * between the bars of one category, centred in the slot.
 */
export const layoutBands = (
  size: number,
  categoryCount: number,
  seriesCount: number,
  maxThickness = 24,
  gap = 2
): BandLayout => {
  const band = categoryCount > 0 ? size / categoryCount : size;
  const usable = Math.max(1, band * 0.7);
  const raw = (usable - gap * (seriesCount - 1)) / Math.max(1, seriesCount);
  const thickness = Math.max(1, Math.min(maxThickness, raw));
  const group = thickness * seriesCount + gap * (seriesCount - 1);
  const start = (band - group) / 2;
  return {
    band,
    thickness,
    offsets: Array.from({ length: seriesCount }, (_, index) => start + index * (thickness + gap)),
  };
};

export type BarDirection = "up" | "down" | "right" | "left";

/** Path of a bar: rounded at the data end (`radius`), square at the baseline. */
export const barShapePath = (
  x: number,
  y: number,
  width: number,
  height: number,
  direction: BarDirection,
  radius = 4
): string => {
  const w = Math.max(0, width);
  const h = Math.max(0, height);
  const r = Math.min(radius, w / 2, h / 2);
  const f = (value: number) => Number(value.toFixed(2));
  switch (direction) {
    case "up":
      return `M${f(x)},${f(y + h)} V${f(y + r)} Q${f(x)},${f(y)} ${f(x + r)},${f(y)} H${f(x + w - r)} Q${f(x + w)},${f(y)} ${f(x + w)},${f(y + r)} V${f(y + h)} Z`;
    case "down":
      return `M${f(x)},${f(y)} V${f(y + h - r)} Q${f(x)},${f(y + h)} ${f(x + r)},${f(y + h)} H${f(x + w - r)} Q${f(x + w)},${f(y + h)} ${f(x + w)},${f(y + h - r)} V${f(y)} Z`;
    case "right":
      return `M${f(x)},${f(y)} H${f(x + w - r)} Q${f(x + w)},${f(y)} ${f(x + w)},${f(y + r)} V${f(y + h - r)} Q${f(x + w)},${f(y + h)} ${f(x + w - r)},${f(y + h)} H${f(x)} Z`;
    case "left":
      return `M${f(x + w)},${f(y)} H${f(x + r)} Q${f(x)},${f(y)} ${f(x)},${f(y + r)} V${f(y + h - r)} Q${f(x)},${f(y + h)} ${f(x + r)},${f(y + h)} H${f(x + w)} Z`;
  }
};

/** Evenly spaced indices to label so at most `maxTicks` show; the first is always included. */
export const selectTickIndices = (count: number, maxTicks: number): number[] => {
  if (count <= 0) return [];
  const limit = Math.max(1, Math.floor(maxTicks));
  if (count <= limit) return Array.from({ length: count }, (_, index) => index);
  const step = Math.ceil(count / limit);
  const indices: number[] = [];
  for (let index = 0; index < count; index += step) indices.push(index);
  return indices;
};

export interface EndLabel {
  id: string;
  y: number;
}

/**
 * Direct labels at a line's end. Labels that would touch another are dropped, never nudged apart: a
 * label pushed away from its line stops belonging to it, and the legend and tooltip carry that series.
 */
export const placeEndLabels = (labels: readonly EndLabel[], minGap = 14): Set<string> => {
  const placed: EndLabel[] = [];
  for (const label of [...labels].sort((a, b) => a.y - b.y)) {
    const previous = placed.at(-1);
    if (!previous || label.y - previous.y >= minGap) placed.push(label);
  }
  return new Set(placed.map((label) => label.id));
};

/** Whether a value label of `textWidth` fits in `room` px with padding on both sides. */
export const labelFits = (textWidth: number, room: number, padding = 6): boolean =>
  textWidth + padding * 2 <= room;

/** Which series' bar a position inside a category slot belongs to: the nearest, for a click between bars. */
export const seriesAtOffset = (layout: BandLayout, offsetInBand: number): number => {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  layout.offsets.forEach((offset, index) => {
    const centre = offset + layout.thickness / 2;
    const distance = Math.abs(centre - offsetInBand);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
};
