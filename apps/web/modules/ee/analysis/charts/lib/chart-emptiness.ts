import type { TChartQuery } from "@formbricks/types/analysis";
import { getResponseBaseMeasureId } from "@/modules/ee/analysis/lib/schema-definition";
import type { TChartDataRow } from "@/modules/ee/analysis/types/analysis";

/** Counts every Feedback Record in the query's scope, so it is 0 only when nothing matched. */
const RECORD_COUNT_MEASURE_ID = "FeedbackRecords.count";

const isEmptyCell = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  (typeof value === "string" && value.trim() === "") ||
  (typeof value === "number" && !Number.isFinite(value));

const toFiniteNumber = (value: unknown): number | null => {
  if (isEmptyCell(value)) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

/**
 * Whether a chart's result has nothing to draw, so every chart type shows the same empty state
 * instead of its own idea of nothing (a "0" big number, a 0–1 axis with a "0" bar, a blank pie).
 *
 * Cube decides the shape: a grouped query returns no rows when no record matched, but a measure-only
 * query always returns its one aggregate row — a count of 0 and NULL for every average. So "no rows"
 * alone misses the ungrouped case, and the result is empty when any of these holds:
 *
 * 1. **There are no rows.**
 * 2. **No selected measure carries a reading on any row.** Every cell is NULL: averages and scores
 *    with nothing to divide.
 * 3. **A count of the chart's whole population sums to 0.** That is `FeedbackRecords.count`, or the
 *    response base every measure on the chart is computed over (e.g. the NPS answer count behind an
 *    NPS score and its promoter count). Every other measure is a subset of that population, so
 *    nothing can have matched.
 *
 * A measured 0 otherwise stays a reading: a count of very negative feedback of 0 next to records
 * that exist is an answer, not missing data, and nothing in a lone count row tells the two apart. So
 * only a population count proves emptiness. Unique respondents and unique responses do not, since
 * anonymous or non-survey records can be counted by the record count but not by them.
 *
 * When no selected measure is a column on the rows (an unexpected shape), the rows are not judged
 * empty: hiding data on a guess is worse than drawing it.
 */
export const isChartResultEmpty = (
  rows: readonly TChartDataRow[] | undefined,
  query: TChartQuery
): boolean => {
  if (!rows || rows.length === 0) return true;

  const columns = new Set(rows.flatMap((row) => Object.keys(row)));
  const selectedMeasures = query.measures ?? [];
  const responseBase = getResponseBaseMeasureId(selectedMeasures);
  const measures = [...new Set([...selectedMeasures, ...(responseBase ? [responseBase] : [])])].filter(
    (measure) => columns.has(measure)
  );
  if (measures.length === 0) return false;

  if (rows.every((row) => measures.every((measure) => isEmptyCell(row[measure])))) return true;

  const populationCounts = [RECORD_COUNT_MEASURE_ID, responseBase].filter(
    (measure): measure is string => measure !== undefined && columns.has(measure)
  );
  return populationCounts.some((measure) =>
    rows.every((row) => {
      const count = toFiniteNumber(row[measure]);
      return count === null || count === 0;
    })
  );
};
