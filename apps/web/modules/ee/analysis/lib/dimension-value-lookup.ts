import type { TChartQuery } from "@formbricks/types/analysis";
import { FIELD_TYPE_OPTIONS } from "@/modules/ee/unify-feedback/lib/types";

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
 * `limit` counts grouped rows, not distinct labels, so a label stored under several field types
 * spends one row per type and `collectDimensionValues` dedups it back down to one entry. The
 * multiplier is the field-type cardinality rather than a guess: a label can appear at most once per
 * `(label, fieldType)` pair, and `field_type` is the closed `FIELD_TYPE_OPTIONS` enum, so
 * `limit * FIELD_TYPE_OPTIONS.length` rows cannot come back with fewer than `limit` distinct labels
 * while any remain. A smaller factor truncates a directory that does have `limit` labels — two rows
 * per label is the common case, but nothing constrains a label to two types.
 */
const FIELD_TYPE_ROW_OVERFETCH = FIELD_TYPE_OPTIONS.length;

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
