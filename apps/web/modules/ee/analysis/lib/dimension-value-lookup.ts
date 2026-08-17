import type { TChartQuery } from "@formbricks/types/analysis";

export const QUESTION_LABEL_DIMENSION_ID = "FeedbackRecords.fieldLabel";
export const FIELD_TYPE_DIMENSION_ID = "FeedbackRecords.fieldType";

/** A distinct dimension value, carrying its field type when the dimension is the question label. */
export interface TDimensionValue {
  value: string;
  fieldType?: string;
}

/**
 * Rows fetched per distinct value wanted, when the query groups by label *and* field type.
 *
 * `limit` counts grouped rows, not distinct labels, so a label stored under two field types spends
 * two of them and `collectDimensionValues` dedups it back down to one entry. Without the headroom a
 * directory with fewer than `limit` distinct labels could still come back truncated. Two covers the
 * realistic case (a source re-typed a question once); a label under three or more types can still
 * truncate, which is why the caller caps the deduped list rather than trusting the row count.
 */
const FIELD_TYPE_ROW_OVERFETCH = 2;

/**
 * The question-label lookup pairs each label with its field type so the pick-list can
 * show the question-type icon. Every other dimension is looked up on its own.
 */
export const buildDimensionValueQuery = ({
  dimension,
  limit,
  search,
}: {
  dimension: string;
  limit: number;
  search?: string;
}): TChartQuery => {
  const withFieldType = dimension === QUESTION_LABEL_DIMENSION_ID;

  return {
    dimensions: withFieldType ? [dimension, FIELD_TYPE_DIMENSION_ID] : [dimension],
    // The secondary key matters: ties on the label are otherwise ordered however the store happens to
    // return them, and `collectDimensionValues` keeps the first row — so which icon a twice-typed
    // label shows would vary between identical queries.
    order: withFieldType
      ? [
          [dimension, "asc"],
          [FIELD_TYPE_DIMENSION_ID, "asc"],
        ]
      : [[dimension, "asc"]],
    limit: withFieldType ? limit * FIELD_TYPE_ROW_OVERFETCH : limit,
    ...(search ? { filters: [{ member: dimension, operator: "contains", values: [search] }] } : {}),
  };
};

/**
 * Reduces Cube rows to distinct, trimmed values in row order. A question label can appear
 * on several rows (one per field type it was stored with, e.g. after a source changed a
 * question's type); the first row wins so the list stays one entry per question.
 *
 * `limit` caps the deduped values, since the query over-fetches rows to absorb those duplicates.
 */
export const collectDimensionValues = (
  rows: unknown,
  dimension: string,
  limit?: number
): TDimensionValue[] => {
  const seen = new Set<string>();
  const values: TDimensionValue[] = [];

  for (const row of Array.isArray(rows) ? rows : []) {
    if (limit !== undefined && values.length >= limit) break;

    const raw = (row as Record<string, unknown>)[dimension];
    if (typeof raw !== "string") continue;

    const value = raw.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);

    const rawFieldType = (row as Record<string, unknown>)[FIELD_TYPE_DIMENSION_ID];
    const fieldType = typeof rawFieldType === "string" ? rawFieldType.trim() : "";

    values.push(fieldType ? { value, fieldType } : { value });
  }

  return values;
};
