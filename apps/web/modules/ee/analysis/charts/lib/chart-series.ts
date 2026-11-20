import type { TChartQuery } from "@formbricks/types/analysis";
import { HUB_SENTIMENT_VALUES } from "@formbricks/types/feedback-source";
import {
  EMOTIONS_DIMENSION_ID,
  EMOTION_MEASURE_ORDER,
  SENTIMENT_DIMENSION_ID,
  VALUE_BAND_DIMENSION_ID,
  VALUE_BAND_VALUES,
  VALUE_ID_DIMENSION_ID,
  VALUE_TEXT_DIMENSION_ID,
  getFieldById,
} from "@/modules/ee/analysis/lib/schema-definition";
import type { TChartDataRow } from "@/modules/ee/analysis/types/analysis";

// ── Empty grouping values ─────────────────────────────────────────────────────

/**
 * Stand-in for an empty grouping value once a chart shows empty values. Recharts and the matrix
 * pivot key their categories by string, and both drop `null` keys, so the empty group needs a real
 * key to survive as a bar, a series or a heatmap row. Never a value a record can hold.
 */
export const EMPTY_GROUP_VALUE = "\u0000empty";

export const isEmptyGroupValue = (value: unknown): boolean =>
  value === null || value === undefined || (typeof value === "string" && value.trim().length === 0);

/**
 * Applies a chart's "Show empty values" setting to its rows.
 *
 * Hidden (the default): a row whose grouping value is empty on any of `groupKeys` is dropped — that
 * covers records with no value for an imported field as well as the "Not enriched" sentiment bucket
 * and the "Unspecified" language bucket, which are empty values with a name.
 *
 * Shown: those rows stay, with the empty value replaced by {@link EMPTY_GROUP_VALUE} so every chart
 * type keeps them as a group of their own. Rows are never mutated.
 */
export const applyEmptyValueSetting = (
  rows: TChartDataRow[],
  groupKeys: readonly string[],
  showEmptyValues: boolean
): TChartDataRow[] => {
  if (groupKeys.length === 0) return rows;
  if (!showEmptyValues) {
    return rows.filter((row) => groupKeys.every((key) => !isEmptyGroupValue(row[key])));
  }
  return rows.map((row) => {
    if (groupKeys.every((key) => !isEmptyGroupValue(row[key]))) return row;
    const next: TChartDataRow = { ...row };
    for (const key of groupKeys) {
      if (isEmptyGroupValue(next[key])) next[key] = EMPTY_GROUP_VALUE;
    }
    return next;
  });
};

/**
 * Folds rows that became one group once their empty values were shown: a null and a blank value for the
 * same grouping both read as the empty group, and drawing them twice would split one bar in two. Rows
 * fold only when every other grouping column (the time bucket too) matches; see `mergeRows` for how
 * values combine. Other rows pass through untouched.
 */
export const collapseEmptyGroupRows = (
  rows: TChartDataRow[],
  groupKeys: readonly string[],
  measureKeys: readonly string[]
): TChartDataRow[] => {
  // Each output slot is a plain row or the list of empty-group rows folded into it, merged once at the end
  // so every row of a group is weighed together.
  const slots: (TChartDataRow | TChartDataRow[])[] = [];
  const byGroup = new Map<string, TChartDataRow[]>();
  for (const row of rows) {
    if (!groupKeys.map((key) => row[key]).includes(EMPTY_GROUP_VALUE)) {
      slots.push(row);
      continue;
    }
    // Keyed by every grouping column the row carries — the time bucket included — so empty groups of
    // different weeks stay apart.
    const idKeys = Object.keys(row)
      .filter((key) => !isMeasureColumn(key, measureKeys))
      .sort((a, b) => a.localeCompare(b));
    const id = JSON.stringify(idKeys.map((key) => [key, row[key] ?? null]));
    const group = byGroup.get(id);
    if (group) {
      group.push(row);
    } else {
      const fresh = [row];
      byGroup.set(id, fresh);
      slots.push(fresh);
    }
  }
  return slots.map((slot) => (Array.isArray(slot) ? mergeRows(slot, measureKeys) : slot));
};

/**
 * Rows ready to draw for a grouped chart: empty groups hidden or kept per the setting, and every empty
 * value of a group (null, "") folded into one row, counts summed and ratios re-weighted by their base.
 * Bar, area, pie and matrix charts all go through here so a shown empty group reads the same in each.
 */
export const prepareGroupedRows = (
  rows: TChartDataRow[],
  groupKeys: readonly string[],
  measureKeys: readonly string[],
  showEmptyValues: boolean
): TChartDataRow[] =>
  collapseEmptyGroupRows(applyEmptyValueSetting(rows, groupKeys, showEmptyValues), groupKeys, measureKeys);

// ── Natural order ─────────────────────────────────────────────────────────────

/**
 * The order a grouping's values have in the survey or on their scale, when they have one: sentiment
 * low → high (mixed last), NPS/CSAT bands positive first, emotions in their fixed series order, and
 * choice answers in the order the survey lists them — by id or by text — from `optionLabels`, which
 * the server sends in survey order. Undefined for groupings without a natural order.
 */
export const getNaturalValueOrder = (
  dimensionId: string,
  optionLabels?: Record<string, string>
): readonly string[] | undefined => {
  if (dimensionId === SENTIMENT_DIMENSION_ID) return HUB_SENTIMENT_VALUES;
  if (dimensionId === VALUE_BAND_DIMENSION_ID) return VALUE_BAND_VALUES;
  if (dimensionId === EMOTIONS_DIMENSION_ID) return EMOTION_MEASURE_ORDER;
  if (dimensionId === VALUE_ID_DIMENSION_ID && optionLabels) return Object.keys(optionLabels);
  // Grouped by answer text, the same map gives the order as labels. Its labels are the survey's
  // default language, so an answer recorded in another language sorts after them, largest first.
  if (dimensionId === VALUE_TEXT_DIMENSION_ID && optionLabels)
    return [...new Set(Object.values(optionLabels))];
  return undefined;
};

const isNumericDimension = (dimensionId: string): boolean => getFieldById(dimensionId)?.type === "number";

const toFiniteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

/**
 * Orders the distinct values of one grouping.
 *
 * Values with a natural order (see {@link getNaturalValueOrder}) follow it; a numeric grouping (a
 * rating's value) runs low → high like its scale; everything else goes largest first by `weight`,
 * ties alphabetically so the order is stable. The empty group always goes last.
 */
export const orderGroupValues = (
  values: readonly string[],
  dimensionId: string,
  weight: (value: string) => number,
  optionLabels?: Record<string, string>
): string[] => {
  const natural = getNaturalValueOrder(dimensionId, optionLabels);
  const numeric = !natural && isNumericDimension(dimensionId);
  const rank = (value: string): number => {
    const index = natural?.indexOf(value) ?? -1;
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  return [...values].sort((a, b) => {
    if (a === EMPTY_GROUP_VALUE || b === EMPTY_GROUP_VALUE) {
      return Number(a === EMPTY_GROUP_VALUE) - Number(b === EMPTY_GROUP_VALUE);
    }
    if (natural) {
      const byRank = rank(a) - rank(b);
      if (byRank !== 0) return byRank;
    } else if (numeric) {
      const byNumber = (toFiniteNumber(a) ?? Infinity) - (toFiniteNumber(b) ?? Infinity);
      if (byNumber !== 0) return byNumber;
    } else {
      const byWeight = weight(b) - weight(a);
      if (byWeight !== 0) return byWeight;
    }
    return a.localeCompare(b);
  });
};

/** A grouping value as a category key; empty values arrive as {@link EMPTY_GROUP_VALUE} by now. */
export const toGroupKey = (value: unknown): string => {
  if (value === null || value === undefined) return EMPTY_GROUP_VALUE;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
};

/**
 * Sorts a single-axis chart's rows along a category grouping: natural order when the grouping has
 * one, low → high for a numeric grouping, otherwise largest `measureKey` first. A time axis is left
 * alone — the query already returns it chronologically.
 */
export const sortCategoryRows = (
  rows: TChartDataRow[],
  categoryKey: string,
  measureKey: string | undefined,
  optionLabels?: Record<string, string>
): TChartDataRow[] => {
  const weightByValue = new Map<string, number>();
  for (const row of rows) {
    const key = toGroupKey(row[categoryKey]);
    const value = measureKey ? (toFiniteNumber(row[measureKey]) ?? 0) : 0;
    weightByValue.set(key, (weightByValue.get(key) ?? 0) + value);
  }
  const order = orderGroupValues(
    [...weightByValue.keys()],
    categoryKey,
    (value) => weightByValue.get(value) ?? 0,
    optionLabels
  );
  const position = new Map(order.map((value, index) => [value, index]));
  return [...rows].sort(
    (a, b) =>
      (position.get(toGroupKey(a[categoryKey])) ?? 0) - (position.get(toGroupKey(b[categoryKey])) ?? 0)
  );
};

// ── Grouped series ────────────────────────────────────────────────────────────

/** One drawn series of a grouped chart: one measure for one group value. */
export interface TGroupedSeries {
  /** Synthetic column the series' values are stored under on each pivoted row. */
  key: string;
  measureKey: string;
  /** The group value (or values, joined) this series stands for. */
  groupValues: string[];
}

export interface TGroupedChartData {
  /** One row per category (time bucket or first grouping value), one column per series. */
  rows: TChartDataRow[];
  series: TGroupedSeries[];
}

/** Prefix of the synthetic series columns, so they never collide with a Cube member. */
export const GROUPED_SERIES_KEY_PREFIX = "__series_";

/** Counts can be summed across groups and are 0 where a group has no records; ratios cannot. */
export const isAdditiveMeasure = (measureKey: string): boolean => {
  const field = getFieldById(measureKey);
  return field !== undefined && "group" in field && field.group === "count";
};

/**
 * Pivots a result grouped on the category axis *and* on further groupings into one row per category
 * with one column per (measure, group) pair — the shape recharts needs to draw one line or bar
 * series per group.
 *
 * Without it every (category, group) row became its own x tick: a weekly chart grouped by source
 * drew one tangled line through "week 1 / source A, week 1 / source B, …" and lost its dates.
 *
 * Every group is drawn (no cap). A group with no records in a bucket is 0 for a count, which is what
 * Cube's missing row means, and a gap (null) for a ratio, which has no value there.
 */
export const buildGroupedSeries = ({
  rows,
  categoryKey,
  groupKeys,
  measureKeys,
  groupOrder,
}: {
  rows: TChartDataRow[];
  categoryKey: string;
  groupKeys: readonly string[];
  measureKeys: readonly string[];
  /** Orders the combined group values; receives each combination's total of the first measure. */
  groupOrder: (groupValues: string[][], weight: (values: string[]) => number) => string[][];
}): TGroupedChartData => {
  const comboId = (values: string[]): string => JSON.stringify(values);
  const combos = new Map<string, string[]>();
  const comboWeight = new Map<string, number>();
  const categories: TChartDataRow[string][] = [];
  const categorySeen = new Set<string>();
  const cells = new Map<string, TChartDataRow[]>();

  for (const row of rows) {
    const category = row[categoryKey];
    const categoryId = toGroupKey(category);
    if (!categorySeen.has(categoryId)) {
      categorySeen.add(categoryId);
      categories.push(category);
    }
    const values = groupKeys.map((key) => toGroupKey(row[key]));
    const id = comboId(values);
    if (!combos.has(id)) combos.set(id, values);
    const firstMeasure = measureKeys[0];
    comboWeight.set(id, (comboWeight.get(id) ?? 0) + (toFiniteNumber(row[firstMeasure]) ?? 0));
    // Rows that land on the same cell — a null and a blank value both shown as the empty group — are
    // one group, folded as `mergeRows` describes.
    const cellKey = `${categoryId}\u0000${id}`;
    const cellRows = cells.get(cellKey);
    if (cellRows) cellRows.push(row);
    else cells.set(cellKey, [row]);
  }

  const orderedCombos = groupOrder([...combos.values()], (values) => comboWeight.get(comboId(values)) ?? 0);

  const series: TGroupedSeries[] = [];
  measureKeys.forEach((measureKey, measureIndex) => {
    orderedCombos.forEach((groupValues, groupIndex) => {
      series.push({
        key: `${GROUPED_SERIES_KEY_PREFIX}${measureIndex}_${groupIndex}`,
        measureKey,
        groupValues,
      });
    });
  });

  const pivoted = categories.map((category) => {
    const categoryId = toGroupKey(category);
    const out: TChartDataRow = { [categoryKey]: category };
    for (const entry of series) {
      const cellRows = cells.get(`${categoryId}\u0000${comboId(entry.groupValues)}`);
      const source = cellRows ? mergeRows(cellRows, measureKeys) : undefined;
      const value = source ? toFiniteNumber(source[entry.measureKey]) : null;
      out[entry.key] = value ?? (isAdditiveMeasure(entry.measureKey) ? 0 : null);
    }
    return out;
  });

  return { rows: pivoted, series };
};

/** Whether a result column holds a measure (a value to fold) rather than a grouping (part of the key). */
const isMeasureColumn = (key: string, measureKeys: readonly string[]): boolean => {
  if (measureKeys.includes(key)) return true;
  const field = getFieldById(key);
  return field !== undefined && "group" in field;
};

/**
 * A ratio over several rows, weighted by the answers each was computed from. Rows without a value add
 * nothing. If more than one row has a value and any of them lacks its base, the merge cannot be computed
 * and the result is null — whatever the order of the rows, so a failed merge never turns back into one
 * row's reading.
 */
const mergeRatio = (measureKey: string, rows: readonly TChartDataRow[]): number | null => {
  const valued = rows.filter((row) => toFiniteNumber(row[measureKey]) !== null);
  if (valued.length === 0) return null;
  if (valued.length === 1) return toFiniteNumber(valued[0][measureKey]);
  const field = getFieldById(measureKey);
  const baseKey = field && "responseBaseMeasureId" in field ? field.responseBaseMeasureId : undefined;
  if (!baseKey) return null;
  let weighted = 0;
  let total = 0;
  for (const row of valued) {
    const base = toFiniteNumber(row[baseKey]);
    if (base === null) return null;
    weighted += (toFiniteNumber(row[measureKey]) ?? 0) * base;
    total += base;
  }
  return total > 0 ? weighted / total : null;
};

/**
 * The result rows of one group, folded into one: counts add up; a score or an average is re-weighted by
 * the answers behind each row (its response base), which is how Cube would have computed it over the
 * merged group. A ratio that cannot be recomputed becomes null — a gap, never one row's reading passed
 * off as the whole group's.
 */
const mergeRows = (rows: readonly TChartDataRow[], measureKeys: readonly string[]): TChartDataRow => {
  if (rows.length === 1) return rows[0];
  const merged: TChartDataRow = { ...rows[0] };
  const measures = new Set([
    ...measureKeys,
    ...rows.flatMap((row) => Object.keys(row).filter((key) => isMeasureColumn(key, measureKeys))),
  ]);
  for (const key of measures) {
    merged[key] = isAdditiveMeasure(key)
      ? rows.reduce((sum, row) => sum + (toFiniteNumber(row[key]) ?? 0), 0)
      : mergeRatio(key, rows);
  }
  return merged;
};

/** Sum of every series column on a pivoted row — the stacked bar's total. */
export const sumSeries = (row: TChartDataRow, seriesKeys: readonly string[]): number =>
  seriesKeys.reduce((sum, key) => sum + (toFiniteNumber(row[key]) ?? 0), 0);

// ── Labels ────────────────────────────────────────────────────────────────────

/** "Family: Name" → ["Family", "Name"]; a space before the colon ("Famille : Nom") is allowed. Plain string
 * search rather than a regex, which would backtrack on long labels. */
const splitLabelPrefix = (label: string): [string, string] | null => {
  const colon = label.indexOf(":");
  if (colon <= 0 || label[colon + 1] !== " ") return null;
  const prefix = label.slice(0, colon).trimEnd();
  const rest = label.slice(colon + 1).trimStart();
  return prefix && rest ? [prefix, rest] : null;
};

/**
 * Drops a "Family: " prefix every label shares ("NPS: Promoters", "NPS: Passives" → "Promoters",
 * "Passives"). The legend, a heatmap header or an axis repeats the family on every entry, and the
 * chart name says it once already. Labels are left alone unless there are two or more and all of
 * them carry the same prefix, so a lone "NPS: Score" keeps its context.
 */
export const stripSharedLabelPrefix = (labels: readonly string[]): string[] => {
  if (labels.length < 2) return [...labels];
  const parts = labels.map(splitLabelPrefix);
  if (parts.includes(null)) return [...labels];
  const prefix = parts[0]?.[0];
  if (!prefix || parts.some((part) => part?.[0] !== prefix)) return [...labels];
  return parts.map((part) => part?.[1] ?? "");
};

// ── Bar layout ────────────────────────────────────────────────────────────────

/**
 * Bars of several series can be stacked only when they are parts of one whole: counts. Stacking an
 * NPS score on a CSAT average adds up to nothing.
 */
export const canStackSeries = (measureKeys: readonly string[]): boolean =>
  measureKeys.length > 0 && measureKeys.every(isAdditiveMeasure);

// ── Query shape ───────────────────────────────────────────────────────────────

export interface TChartGrouping {
  /** What the category axis is keyed by: the time bucket when there is one, else the first grouping. */
  categoryKey: string | undefined;
  /** Whether the category axis is a time bucket. */
  isTimeCategory: boolean;
  /** Groupings drawn as separate series on top of the category axis. */
  groupKeys: string[];
  /** Every grouping dimension, the ones the empty-value setting applies to. */
  dimensionKeys: string[];
}

/**
 * Splits a query's groupings into the category axis and the series drawn on it. Time always takes
 * the axis — a trend is read left to right — and every grouping then becomes a series ("one line per
 * source"). Without a time bucket the first grouping is the axis and any further one the series.
 */
export const getChartGrouping = (query: TChartQuery | null | undefined): TChartGrouping => {
  const dimensionKeys = [...(query?.dimensions ?? [])];
  const timeDim = query?.timeDimensions?.[0];
  const timeKey = timeDim?.granularity ? `${timeDim.dimension}.${timeDim.granularity}` : undefined;
  if (timeKey) {
    return { categoryKey: timeKey, isTimeCategory: true, groupKeys: dimensionKeys, dimensionKeys };
  }
  return {
    categoryKey: dimensionKeys[0],
    isTimeCategory: false,
    groupKeys: dimensionKeys.slice(1),
    dimensionKeys,
  };
};

/** Whether a bar chart of this query has several series per category that the bar layout applies to. */
export const hasStackableSeries = (query: TChartQuery | null | undefined): boolean => {
  const measures = query?.measures ?? [];
  const grouping = getChartGrouping(query);
  if (!grouping.categoryKey) return false;
  const seriesPerCategory = grouping.groupKeys.length > 0 || measures.length > 1;
  return seriesPerCategory && canStackSeries(measures);
};

// ── Series styling ────────────────────────────────────────────────────────────

/**
 * Series colors: meaning-bound where the series has a meaning, the palette for the rest — handed out
 * only to the series without one, so a semantic series never uses up a categorical hue.
 */
export const assignSeriesColors = (
  semanticColors: readonly (string | undefined)[],
  palette: readonly string[]
): string[] => {
  let paletteIndex = 0;
  return semanticColors.map((color) => {
    if (color) return color;
    const next = palette[paletteIndex % palette.length];
    paletteIndex++;
    return next;
  });
};

/** Corner radius of one stack segment: only the outer one (top, or right when flipped) is rounded. */
export const getStackedBarRadius = (
  isOuter: boolean,
  isHorizontal: boolean
): [number, number, number, number] => {
  if (!isOuter) return [0, 0, 0, 0];
  return isHorizontal ? [0, 4, 4, 0] : [4, 4, 0, 0];
};

/**
 * Orders the group combinations of a grouped chart: one grouping follows {@link orderGroupValues}
 * (natural order, else largest first); several groupings go largest first by combined weight.
 */
export const orderGroupCombos = (
  combos: string[][],
  groupKeys: readonly string[],
  weight: (values: string[]) => number,
  optionLabels?: Record<string, string>
): string[][] => {
  if (groupKeys.length !== 1) return [...combos].sort((a, b) => weight(b) - weight(a));
  const dimensionId = groupKeys[0];
  const order = orderGroupValues(
    combos.map((values) => values[0]),
    dimensionId,
    (value) => weight([value]),
    optionLabels
  );
  return order.map((value) => [value]);
};
