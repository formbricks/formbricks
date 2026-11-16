import type { TChartQuery } from "@formbricks/types/analysis";
import { FIELD_TYPE_DIMENSION_ID } from "@/modules/ee/analysis/lib/dimension-value-lookup";
import { collectQueryMemberNames } from "@/modules/ee/analysis/lib/embedded-data-fields";
import {
  getResponseBaseFamily,
  getResponseBaseMeasureId,
  isRatioMeasure,
  isResponseTopicDimensionId,
} from "@/modules/ee/analysis/lib/schema-definition";
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
 * - **A dimension is required.** Without one the result is a single measure-only row. Whether that
 *   row is empty is the renderers' call (`isChartResultEmpty`), and when only some of its measures
 *   are empty a measure-pivot bar chart keeps each empty measure's slot on the axis as a gap.
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
 * The query to execute for a `valueId` grouping: the same query plus a `valueId set` filter.
 *
 * Only choice answers (single/multi-select, matrix columns) write a `value_id`; text, rating, NPS
 * and the rest leave it NULL. Left alone, Cube emits one group for all of those rows, so a chart
 * grouped by value option gains a blank-labelled bucket that is not an option and can dwarf the
 * real ones. Filtering in the query, rather than dropping the group afterwards, keeps a `limit`
 * from being spent on that bucket.
 *
 * Execution only: callers keep the original query for what they return and save, so the filter
 * never shows up in the builder. A query that does not group by `valueId` is returned untouched.
 */
export const withOptionIdFilter = (query: TChartQuery): TChartQuery => {
  if (!(query.dimensions ?? []).includes(VALUE_ID_DIMENSION)) return query;
  return { ...query, filters: [...(query.filters ?? []), { member: VALUE_ID_DIMENSION, operator: "set" }] };
};

/**
 * The query to execute for a chart of one score over a response-topic field (ENG-6989): the same query
 * narrowed to that score's answers (`fieldType equals <family>`) wherever that cannot change the chart.
 *
 * A response-topic field joins every answer of each response, and Cube's deduplication then sorts every
 * record of the dataset: about 2 s on 583k records, 0.25 s narrowed. Each measure of a score family only
 * counts that family's answers, so every cell keeps its value; what narrowing can change is which rows
 * exist, since a group whose answers are all of other types disappears instead of showing empty cells.
 * So it applies only where that group could not be seen anyway:
 *
 * - without a dimension or time granularity the result is one row either way;
 * - with dimensions, no time granularity, and only scores and averages (`isRatioMeasure`), such a group
 *   would hold only empty cells, which `dropEmptyMeasureRows` drops.
 *
 * A count reads 0 for such a group and keeps its row, and an empty time bucket is information, so those
 * queries run as they are. Execution only, like `withOptionIdFilter`.
 */
export const withResponseTopicFieldTypeFilter = (query: TChartQuery): TChartQuery => {
  if (![...collectQueryMemberNames(query)].some(isResponseTopicDimensionId)) return query;

  const measures = query.measures ?? [];
  const base = getResponseBaseMeasureId(measures);
  const family = base ? getResponseBaseFamily(base) : undefined;
  if (!family) return query;
  if (query.timeDimensions?.some((timeDimension) => Boolean(timeDimension.granularity))) return query;
  if ((query.dimensions?.length ?? 0) > 0 && !measures.every(isRatioMeasure)) return query;

  const narrowed = (query.filters ?? []).some(
    (filter) =>
      "member" in filter &&
      filter.member === FIELD_TYPE_DIMENSION_ID &&
      filter.operator === "equals" &&
      filter.values?.length === 1 &&
      filter.values[0] === family
  );
  if (narrowed) return query;
  return {
    ...query,
    filters: [
      ...(query.filters ?? []),
      { member: FIELD_TYPE_DIMENSION_ID, operator: "equals", values: [family] },
    ],
  };
};
