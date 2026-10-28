import { type FormatContext, formatFull, formatPercent } from "./format";
import type { DigDeeperTarget } from "./prompt";
import type { CartesianData, PieData } from "./series";

/** What a tooltip, the screen-reader announcement and the "break this down" message say about a point. */

/** Position of a mark: a category and a series (a pie's slices are categories of one series). */
export interface Selection {
  category: number;
  series: number;
}

export interface TooltipRow {
  /** Palette slot, `null` for the neutral Other slice, `undefined` when the row has no swatch. */
  colorIndex?: number | null;
  label: string;
  value: string;
  /** The row the pointer or the keyboard is on. */
  emphasis?: boolean;
}

export interface TooltipContent {
  title: string;
  rows: TooltipRow[];
}

const valueText = (value: number | null, context: FormatContext): string =>
  value === null ? "No data" : formatFull(value, context.locale);

/**
 * Every series at one category, values first in the DOM order the component reads. A chart with one
 * series lists just that one; the title is the category's long label.
 */
export const buildCartesianTooltip = (
  data: CartesianData,
  active: Selection,
  context: FormatContext
): TooltipContent | undefined => {
  const category = data.categories.at(active.category);
  if (!category) return undefined;
  return {
    title: category.fullLabel,
    rows: data.series.map((series, index) => ({
      colorIndex: series.colorIndex,
      label: series.label,
      value: valueText(series.values[active.category] ?? null, context),
      emphasis: data.series.length > 1 && index === active.series,
    })),
  };
};

export const buildPieTooltip = (
  pie: PieData,
  active: Selection,
  measureLabel: string,
  context: FormatContext
): TooltipContent | undefined => {
  const slice = pie.slices.at(active.category);
  if (!slice) return undefined;
  return {
    title: slice.label,
    rows: [
      {
        colorIndex: slice.colorIndex,
        label: measureLabel,
        value: `${formatFull(slice.value, context.locale)} (${formatPercent(slice.share, context.locale)})`,
      },
    ],
  };
};

/** One line for `aria-live`: the title, then each row as "label value". */
export const announce = (content: TooltipContent | undefined): string =>
  content ? `${content.title}: ${content.rows.map((row) => `${row.label} ${row.value}`).join(", ")}` : "";

export interface PointContext {
  chartTitle: string;
  xLabel: string;
  seriesLabel?: string;
  measureLabel: string;
  granularity?: DigDeeperTarget["granularity"];
}

/** The selected point of a cartesian chart, as the pieces the selection bar and the message need. */
export const describeCartesianPoint = (
  data: CartesianData,
  selection: Selection,
  point: PointContext,
  context: FormatContext
): DigDeeperTarget | undefined => {
  const category = data.categories.at(selection.category);
  const series = data.series.at(selection.series);
  if (!category || !series) return undefined;
  const hasSeriesDimension = point.seriesLabel !== undefined;
  return {
    chartTitle: point.chartTitle,
    xLabel: point.xLabel,
    xValue: category.fullLabel,
    ...(point.granularity ? { granularity: point.granularity } : {}),
    ...(hasSeriesDimension ? { seriesLabel: point.seriesLabel, seriesValue: series.label } : {}),
    measureLabel: hasSeriesDimension ? point.measureLabel : series.label,
    valueText: valueText(series.values[selection.category] ?? null, context),
  };
};

export const describePieSlice = (
  pie: PieData,
  selection: Selection,
  point: PointContext,
  context: FormatContext
): DigDeeperTarget | undefined => {
  const slice = pie.slices.at(selection.category);
  if (!slice) return undefined;
  return {
    chartTitle: point.chartTitle,
    xLabel: point.xLabel,
    xValue: slice.label,
    measureLabel: point.measureLabel,
    valueText: formatFull(slice.value, context.locale),
  };
};
