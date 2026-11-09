import { FIELD_TYPE_DIMENSION_ID } from "@/modules/ee/analysis/lib/dimension-value-lookup";
import {
  EMOTIONS_DIMENSION_ID,
  FEEDBACK_FIELDS,
  SENTIMENT_DIMENSION_ID,
  getResponseBaseFamily,
} from "@/modules/ee/analysis/lib/schema-definition";
import { NO_VALUE_PICK, type TDashboardFilter, type TDashboardFilterOperator } from "./dashboard-filters";

/**
 * Sentiment, Sentiment Score and Emotions are set by AI enrichment, and enrichment reads only text answers
 * (docs/unify-feedback/enrichment.mdx): an NPS score, a rating or a yes/no never carries them. A dashboard
 * filter on one of them applied to a chart that shows only such answers leaves it empty — not because nothing
 * matched, but because nothing there could. Such a chart says it cannot be filtered by it instead
 * (`resolvePicksForDataset`), as a chart whose dataset lacks a filter's field does.
 */

/** The fields only AI enrichment sets, and only on text answers. */
export const ENRICHMENT_FIELDS: ReadonlySet<string> = new Set([
  SENTIMENT_DIMENSION_ID,
  "FeedbackRecords.sentimentScore",
  EMOTIONS_DIMENSION_ID,
]);

/**
 * The field types whose records hold no text for enrichment to read. `text` is left out, and so is
 * `categorical`: a choice question's "other" answer is free text, so a categorical record is not provably
 * without one.
 */
const NON_TEXT_FIELD_TYPES: ReadonlySet<string> = new Set([
  "nps",
  "csat",
  "ces",
  "rating",
  "number",
  "boolean",
  "date",
]);

/**
 * The operators a record without a value can never pass: on an enrichment field they need a text answer.
 * `notEquals`, `notContains` and `notSet` are not among them — a record without a value passes each, so
 * "Sentiment is not positive" keeps every NPS answer and is no reason to call a chart unfilterable.
 */
const VALUE_REQUIRING_OPERATORS: ReadonlySet<TDashboardFilterOperator> = new Set([
  "equals",
  "contains",
  "gt",
  "gte",
  "lt",
  "lte",
  "set",
]);

/**
 * Whether a pick can only match a record with a value for an enrichment field: such a pick lets through
 * text answers only. A pick that includes the no-value pick also matches records without one.
 */
export const pickNeedsTextAnswer = (
  filter: Pick<TDashboardFilter, "field" | "operator">,
  values: readonly string[]
): boolean =>
  ENRICHMENT_FIELDS.has(filter.field) &&
  VALUE_REQUIRING_OPERATORS.has(filter.operator) &&
  !values.includes(NO_VALUE_PICK);

/** Whether a fieldType value is one without text, compared as Cube compares it: trimmed, any case. */
const isNonTextFieldType = (value: unknown): boolean =>
  typeof value === "string" && NON_TEXT_FIELD_TYPES.has(value.trim().toLowerCase());

/**
 * Whether a saved rule keeps only records of non-text field types: `fieldType equals` values that all are
 * one, an AND with such a rule in it, or an OR every branch of which is one. Any other rule proves nothing.
 */
const pinsNonTextFieldType = (rule: unknown): boolean => {
  if (typeof rule !== "object" || rule === null) return false;
  const { member, operator, values, and, or } = rule as Record<string, unknown>;
  if (Array.isArray(and)) return and.some(pinsNonTextFieldType);
  if (Array.isArray(or)) return or.length > 0 && or.every(pinsNonTextFieldType);
  return (
    member === FIELD_TYPE_DIMENSION_ID &&
    operator === "equals" &&
    Array.isArray(values) &&
    values.length > 0 &&
    values.every(isNonTextFieldType)
  );
};

/**
 * Whether a measure counts or averages only the answers of one numeric question type (NPS, CSAT, CES,
 * rating): its Cube definition filters on that field type, so it never reads a text answer.
 */
const isNumericAnswerMeasure = (measureId: unknown): boolean => {
  const base = FEEDBACK_FIELDS.measures.find((measure) => measure.id === measureId)?.responseBaseMeasureId;
  return base !== undefined && getResponseBaseFamily(base) !== undefined;
};

/**
 * Whether a chart's saved query provably reads no text answer: its saved filters pin `fieldType` to types
 * without text (`NON_TEXT_FIELD_TYPES`), or every one of its measures reads only one numeric question type.
 * Anything less — a fieldType rule under an OR with another rule, a `count` beside an NPS score — proves
 * nothing, and the chart is filtered as before. Read defensively: a stored query is JSON.
 */
export const chartExcludesTextAnswers = (query: unknown): boolean => {
  if (typeof query !== "object" || query === null) return false;
  const { filters, measures } = query as { filters?: unknown; measures?: unknown };
  if (Array.isArray(filters) && filters.some(pinsNonTextFieldType)) return true;
  return Array.isArray(measures) && measures.length > 0 && measures.every(isNumericAnswerMeasure);
};
