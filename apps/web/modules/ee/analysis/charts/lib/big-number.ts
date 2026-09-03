import type { TChartQuery } from "@formbricks/types/analysis";
import { isRatioMeasure } from "@/modules/ee/analysis/lib/schema-definition";
import type { TChartDataRow, TChartType } from "@/modules/ee/analysis/types/analysis";

/**
 * A big number renders one value and has no axis to put groups on, but the builder's grouping
 * panels stay live when the chart type is switched — so a big number can carry a time granularity
 * or a dimension it cannot show, and the renderer is left with N rows to fold into one.
 *
 * There is no fold that works: adding the per-group values of a ratio is meaningless (a week of
 * daily NPS readings of 100 and -100 summed to 1350 where the period's real NPS was 51.85), and
 * averaging them is wrong too, since each day carries a different number of responses. Even a count
 * cannot always be added — the same person answering on two days is one unique respondent, not two.
 *
 * So the grouping is dropped from the query instead and Cube recomputes each measure over the whole
 * range, which is right for every measure type. The date range stays: it is a filter, not a
 * grouping. `order` goes with the grouping, since it may name a member that is no longer selected
 * and there is only one row left to order.
 */
export const toSingleValueQuery = (query: TChartQuery): TChartQuery => {
  const { dimensions: _dimensions, order: _order, ...rest } = query;
  const timeDimensions = query.timeDimensions?.map(({ granularity: _granularity, ...timeDim }) => timeDim);
  return timeDimensions ? { ...rest, timeDimensions } : rest;
};

/** Apply the query normalization a chart type needs. Only big numbers need one today. */
export const prepareQueryForChartType = (query: TChartQuery, chartType: TChartType): TChartQuery =>
  chartType === "big_number" ? toSingleValueQuery(query) : query;

const toFiniteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

/**
 * The single value a big number shows, or null when there is none to show (the caller renders a
 * no-data glyph rather than a confident number).
 *
 * With {@link toSingleValueQuery} applied there is exactly one row, so this is that row's value. It
 * still folds several rows for an additive measure, but refuses to for a ratio: charts saved before
 * the normalization existed can still arrive grouped, and a summed NPS is worse than no number.
 */
export const computeBigNumberValue = (rows: TChartDataRow[], measureKey: string): number | null => {
  const values = rows.map((row) => toFiniteNumber(row[measureKey])).filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  if (values.length === 1) return values[0];
  if (isRatioMeasure(measureKey)) return null;
  return values.reduce((sum, value) => sum + value, 0);
};
