import type { TChartQuery } from "@formbricks/types/analysis";
import type { TChartDataRow } from "@/modules/ee/analysis/types/analysis";

/**
 * A measure cell that carries no reading. Cube returns NULL for a measure whose filters matched
 * nothing (see `restoreNullMeasures` in cube-client, which maps the pivot's sentinel back to null),
 * and the column can be absent altogether when the query never selected it.
 *
 * Deliberately narrow: only null/undefined, the empty string and a non-finite number count as
 * empty. A measured `0` is a reading — an NPS score of 0 or a count of 0 must keep its row — and an
 * unparseable value is kept too, since this decides what to hide and guessing wrong hides data.
 */
const isEmptyMeasureValue = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  value === "" ||
  (typeof value === "number" && !Number.isFinite(value));

/**
 * Whether empty rows may be dropped from this query's result.
 *
 * Only grouped, non-time queries qualify:
 *
 * - **A dimension is required.** Without one the result is a single measure-only row, and dropping
 *   it would turn "this measure computed to nothing" into "no data available" — a big number
 *   renders that case as an en dash on purpose, and a measure-pivot bar chart keeps the measure's
 *   slot on the axis as a gap.
 * - **A time granularity disqualifies it.** An empty bucket in a time series is information: area
 *   charts render it as a gap (`connectNulls={false}`), and silently removing the bucket would
 *   close the gap and misdate every point after it.
 */
export const canDropEmptyMeasureRows = (query: TChartQuery): boolean =>
  (query.measures?.length ?? 0) > 0 &&
  (query.dimensions?.length ?? 0) > 0 &&
  !query.timeDimensions?.some((timeDimension) => Boolean(timeDimension.granularity));

/**
 * Drop the rows of a grouped result where none of the selected measures resolved.
 *
 * Cube emits one row per group present in the source, not per group the measures can answer for:
 * a chart grouped by Question with `CES: Average` and `CSAT: Average` gets a row for every question
 * in the directory, so questions that are neither CES nor CSAT come back with both measures NULL
 * and render as blank bars and empty rows in Chart Data (ENG-3150).
 *
 * A row survives when at least one selected measure carries a reading, so a group that answers one
 * of several measures keeps its place. Only measures actually present as a column on some row are
 * consulted: if the rewritten query names none of them (a renamed column, an unexpected shape),
 * every row would otherwise be dropped, so the result is returned untouched instead.
 */
export const dropEmptyMeasureRows = (rows: TChartDataRow[], query: TChartQuery): TChartDataRow[] => {
  if (rows.length === 0 || !canDropEmptyMeasureRows(query)) return rows;

  // Every row is consulted rather than just the first: Cube's pivot fills each row with every
  // column (`fillWithValue` in cube-client), but sampling one row would make that an unstated
  // requirement, and a first row missing a measure a later row answers would take that row with it.
  const columns = new Set(rows.flatMap((row) => Object.keys(row)));
  const measures = (query.measures ?? []).filter((measure) => columns.has(measure));
  if (measures.length === 0) return rows;

  return rows.filter((row) => measures.some((measure) => !isEmptyMeasureValue(row[measure])));
};

const VALUE_ID_DIMENSION = "FeedbackRecords.valueId";

/**
 * Drop the groups of a `valueId` grouping that carry no option id.
 *
 * Only choice answers (single/multi-select, matrix columns) write a `value_id`; text, rating, NPS
 * and the rest leave it NULL. Cube still emits one group for all of those rows, so a chart grouped
 * by value option gains a blank-labelled bucket that is not an option and has no label to show. The
 * same bucket is dropped here as in the bar/pie slices and the Chart Data table.
 *
 * Time series are left alone for the reason given on {@link canDropEmptyMeasureRows}: only a
 * grouping the chart draws as option buckets is pruned.
 */
export const dropRowsWithoutOptionId = (rows: TChartDataRow[], query: TChartQuery): TChartDataRow[] => {
  if (!(query.dimensions ?? []).includes(VALUE_ID_DIMENSION)) return rows;
  return rows.filter((row) => {
    const optionId = row[VALUE_ID_DIMENSION];
    return optionId !== null && optionId !== undefined && optionId !== "";
  });
};
