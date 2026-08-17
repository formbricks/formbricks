import type { TChartQuery } from "@formbricks/types/analysis";

export const QUESTION_LABEL_DIMENSION_ID = "FeedbackRecords.fieldLabel";
export const FIELD_TYPE_DIMENSION_ID = "FeedbackRecords.fieldType";

/** A distinct dimension value, carrying its field type when the dimension is the question label. */
export interface TDimensionValue {
  value: string;
  fieldType?: string;
}

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
    order: [[dimension, "asc"]],
    limit,
    ...(search ? { filters: [{ member: dimension, operator: "contains", values: [search] }] } : {}),
  };
};

/**
 * Reduces Cube rows to distinct, trimmed values in row order. A question label can appear
 * on several rows (one per field type it was stored with, e.g. after a source changed a
 * question's type); the first row wins so the list stays one entry per question.
 */
export const collectDimensionValues = (rows: unknown, dimension: string): TDimensionValue[] => {
  const seen = new Set<string>();
  const values: TDimensionValue[] = [];

  for (const row of Array.isArray(rows) ? rows : []) {
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
