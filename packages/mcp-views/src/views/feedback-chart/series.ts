import type { FormatContext } from "../../shared/format";
import {
  formatCompact,
  formatFull,
  formatTimeFull,
  formatTimeLabel,
  humanizeValue,
  parseTimestamp,
} from "./format";
import type { CellValue, ChartColumn, FeedbackChartModel, Granularity } from "./model";

/** Shapes the query rows into what each chart draws. Pure: the components only place what this returns. */

export const MAX_SERIES = 8;
export const MAX_BAR_CATEGORIES = 30;
export const MAX_PIE_SLICES = 7;

const asNumber = (value: CellValue | undefined): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const columnOf = (model: FeedbackChartModel, id: string | undefined): ChartColumn | undefined =>
  id ? model.columns.find((column) => column.id === id) : undefined;

const labelOf = (model: FeedbackChartModel, id: string): string => columnOf(model, id)?.label ?? id;

export interface Category {
  id: string;
  /** Short text for the axis. */
  label: string;
  /** Long text for the tooltip, the table and the message to the agent. */
  fullLabel: string;
  /** Position on a time axis. */
  ms?: number;
  /** The grouping value as the analytics service sent it. */
  raw: CellValue;
}

export interface Series {
  id: string;
  label: string;
  /** Index into the palette, stable for the entity within this result. */
  colorIndex: number;
  measureId: string;
  values: (number | null)[];
}

export interface CartesianData {
  categories: Category[];
  series: Series[];
  isTime: boolean;
  granularity?: Granularity;
  /** The fixed range of the plotted score, when it has one and one measure is plotted. */
  fixedDomain?: [number, number];
  /** Series and categories left out of the picture; they are in the table. */
  hiddenSeries: number;
  hiddenCategories: number;
}

const spansYears = (categories: Category[]): boolean => {
  const years = new Set(
    categories.filter((c) => c.ms !== undefined).map((c) => new Date(c.ms ?? 0).getUTCFullYear())
  );
  return years.size > 1;
};

const buildCategories = (
  model: FeedbackChartModel,
  context: FormatContext
): { categories: Category[]; order: number[] } => {
  const { spec } = model;
  const xId = spec.x;
  const seen = new Map<string, number>();
  const categories: Category[] = [];
  if (!xId) return { categories, order: [] };
  const timeGranularity = spec.xKind === "time" ? spec.granularity : undefined;

  for (const row of model.rows) {
    const raw = row[xId] ?? null;
    const id = String(raw);
    if (seen.has(id)) continue;
    seen.set(id, categories.length);
    const point = timeGranularity ? parseTimestamp(raw) : undefined;
    categories.push({
      id,
      label: id,
      fullLabel: id,
      raw,
      ...(point ? { ms: point.ms } : {}),
    });
  }

  if (timeGranularity) {
    categories.sort((a, b) => (a.ms ?? Number.POSITIVE_INFINITY) - (b.ms ?? Number.POSITIVE_INFINITY));
    const withYear = spansYears(categories);
    for (const category of categories) {
      const point = parseTimestamp(category.raw);
      if (!point) {
        category.label = humanizeValue(xId, category.raw, context.locale);
        category.fullLabel = category.label;
        continue;
      }
      category.label = formatTimeLabel(point, timeGranularity, context, withYear);
      category.fullLabel = formatTimeFull(point, timeGranularity, context);
    }
  } else {
    for (const category of categories) {
      category.label = humanizeValue(xId, category.raw, context.locale);
      category.fullLabel = category.label;
    }
  }
  return { categories, order: categories.map((_, index) => index) };
};

const totalMagnitude = (values: (number | null)[]): number =>
  values.reduce<number>((sum, value) => sum + Math.abs(value ?? 0), 0);

/**
 * Rows to categories x series. With a series dimension the one plotted measure is split by it; without
 * one every plotted measure is a series of its own. More than eight series keep the eight largest (the
 * palette has no ninth hue) and say how many were left out.
 */
export const buildCartesian = (model: FeedbackChartModel, context: FormatContext = {}): CartesianData => {
  const { spec } = model;
  const xId = spec.x;
  const isTime = spec.xKind === "time" && spec.granularity !== undefined;
  const { categories: allCategories } = buildCategories(model, context);
  const indexById = new Map(allCategories.map((category, index) => [category.id, index]));

  let series: Series[] = [];
  if (xId && spec.series) {
    const measureId = spec.y[0];
    const byValue = new Map<string, Series>();
    for (const row of model.rows) {
      const raw = row[spec.series] ?? null;
      const id = String(raw);
      let entry = byValue.get(id);
      if (!entry) {
        entry = {
          id,
          label: humanizeValue(spec.series, raw, context.locale),
          colorIndex: byValue.size,
          measureId,
          values: allCategories.map(() => null),
        };
        byValue.set(id, entry);
      }
      const at = indexById.get(String(row[xId] ?? null));
      if (at !== undefined) entry.values[at] = asNumber(row[measureId]);
    }
    series = [...byValue.values()];
  } else if (xId) {
    series = spec.y.map((measureId, index) => ({
      id: measureId,
      label: labelOf(model, measureId),
      colorIndex: index,
      measureId,
      values: allCategories.map(() => null),
    }));
    for (const row of model.rows) {
      const at = indexById.get(String(row[xId] ?? null));
      if (at === undefined) continue;
      for (const entry of series) entry.values[at] = asNumber(row[entry.measureId]);
    }
  }

  let hiddenSeries = 0;
  if (series.length > MAX_SERIES) {
    const kept = new Set(
      [...series]
        .sort((a, b) => totalMagnitude(b.values) - totalMagnitude(a.values))
        .slice(0, MAX_SERIES)
        .map((entry) => entry.id)
    );
    hiddenSeries = series.length - MAX_SERIES;
    // Colours follow the entity: the survivors keep the slots they had, in their original order.
    series = series
      .filter((entry) => kept.has(entry.id))
      .map((entry, index) => ({ ...entry, colorIndex: index }));
  }

  let categories = allCategories;
  let hiddenCategories = 0;
  if (spec.type === "bar" && categories.length > MAX_BAR_CATEGORIES) {
    hiddenCategories = categories.length - MAX_BAR_CATEGORIES;
    categories = categories.slice(0, MAX_BAR_CATEGORIES);
    series = series.map((entry) => ({ ...entry, values: entry.values.slice(0, MAX_BAR_CATEGORIES) }));
  }

  const plottedMeasure = new Set(series.map((entry) => entry.measureId));
  const fixedDomain = plottedMeasure.size === 1 ? columnOf(model, [...plottedMeasure][0])?.domain : undefined;

  return {
    categories,
    series,
    isTime,
    ...(isTime && spec.granularity ? { granularity: spec.granularity } : {}),
    ...(fixedDomain ? { fixedDomain } : {}),
    hiddenSeries,
    hiddenCategories,
  };
};

export interface Slice {
  id: string;
  label: string;
  value: number;
  share: number;
  /** Palette slot, or `null` for the neutral "Other" slice. */
  colorIndex: number | null;
  /** How many categories an "Other" slice stands for. */
  merged?: number;
}

export interface PieData {
  slices: Slice[];
  total: number;
  /** Categories with no positive value: nothing to draw, still in the table. */
  skipped: number;
}

/** The largest seven categories and the rest folded into "Other". Only counts reach a pie (the server checks). */
export const buildPie = (model: FeedbackChartModel, context: FormatContext = {}): PieData => {
  const { spec } = model;
  const xId = spec.x;
  const measureId = spec.y[0];
  if (!xId || !measureId) return { slices: [], total: 0, skipped: 0 };

  const entries = model.rows.map((row) => ({
    raw: row[xId] ?? null,
    value: asNumber(row[measureId]),
  }));
  const positive = entries
    .filter((entry): entry is { raw: CellValue; value: number } => entry.value !== null && entry.value > 0)
    .sort((a, b) => b.value - a.value);
  const skipped = entries.length - positive.length;
  const total = positive.reduce((sum, entry) => sum + entry.value, 0);
  if (total <= 0) return { slices: [], total: 0, skipped };

  const head = positive.length > MAX_PIE_SLICES ? positive.slice(0, MAX_PIE_SLICES - 1) : positive;
  const tail = positive.length > MAX_PIE_SLICES ? positive.slice(MAX_PIE_SLICES - 1) : [];
  const slices: Slice[] = head.map((entry, index) => ({
    id: String(entry.raw),
    label: humanizeValue(xId, entry.raw, context.locale),
    value: entry.value,
    share: entry.value / total,
    colorIndex: index,
  }));
  if (tail.length > 0) {
    const value = tail.reduce((sum, entry) => sum + entry.value, 0);
    slices.push({
      id: "__other__",
      label: `Other (${tail.length})`,
      value,
      share: value / total,
      colorIndex: null,
      merged: tail.length,
    });
  }
  return { slices, total, skipped };
};

export interface BigNumber {
  id: string;
  label: string;
  value: number | null;
  compact: string;
  full: string;
}

/** One number per plotted measure, read from the first row. A missing value stays missing, never zero. */
export const buildNumbers = (model: FeedbackChartModel, context: FormatContext = {}): BigNumber[] => {
  const row = model.rows.at(0);
  return model.spec.y.map((measureId) => {
    const value = row ? asNumber(row[measureId]) : null;
    return {
      id: measureId,
      label: labelOf(model, measureId),
      value,
      compact: value === null ? "No data" : formatCompact(value, context.locale),
      full: value === null ? "No answers to score" : formatFull(value, context.locale),
    };
  });
};
