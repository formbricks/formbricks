/**
 * Schema definitions for FeedbackRecords fields.
 * Used by the advanced chart builder to provide field metadata and operators.
 */
import type { TFunction } from "i18next";

export interface FieldDefinition {
  id: string;
  label: string;
  type: "string" | "number" | "time" | "boolean";
  description?: string;
  isGenerated?: boolean;
}

export interface MeasureDefinition {
  id: string;
  label: string;
  type: "count" | "number";
  description?: string;
}

/**
 * Hub enrichment enum vocabularies (migrations 014/015). Single source for the
 * enum dimension values: the generated emotion-count measures, the translated
 * value-label maps (typed against these tuples, so additions fail the build until
 * every map is updated), and the ordinal sentiment axis sort all derive from them.
 */
export const SENTIMENT_VALUE_ORDER = [
  "very_negative",
  "negative",
  "neutral",
  "positive",
  "very_positive",
  "mixed",
] as const;

export const EMOTION_VALUES = ["joy", "anger", "sadness", "fear", "surprise", "disgust"] as const;

export type TSentimentValue = (typeof SENTIMENT_VALUE_ORDER)[number];
export type TEmotionValue = (typeof EMOTION_VALUES)[number];

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

// One structurally identical count measure per emotion; mirrors the <emotion>Count
// measures in the Cube schema (docker/cube/schema/FeedbackRecords.js).
const EMOTION_COUNT_MEASURES: MeasureDefinition[] = EMOTION_VALUES.map((emotion) => ({
  id: `FeedbackRecords.${emotion}Count`,
  label: `${capitalize(emotion)} Count`,
  type: "count",
  description: `Number of feedback records tagged with the "${emotion}" emotion`,
}));

export const FEEDBACK_FIELDS = {
  dimensions: [
    {
      id: "FeedbackRecords.sourceType",
      label: "Source Type",
      type: "string",
      description: "Source type of the feedback (e.g., nps_campaign, survey)",
    },
    {
      id: "FeedbackRecords.sourceName",
      label: "Source Name",
      type: "string",
      description: "Human-readable name of the source",
    },
    {
      id: "FeedbackRecords.fieldType",
      label: "Field Type",
      type: "string",
      description: "Type of feedback field (e.g., nps, text, rating)",
    },
    {
      id: "FeedbackRecords.fieldLabel",
      label: "Question",
      type: "string",
      description: "Human-readable label of the question/field",
    },
    {
      id: "FeedbackRecords.fieldGroupLabel",
      label: "Question Group",
      type: "string",
      description: "Label of the parent composite question for matrix/ranking rows",
    },
    {
      id: "FeedbackRecords.language",
      label: "Language",
      type: "string",
      description: 'Response language code (e.g., "en", "de")',
    },
    {
      id: "FeedbackRecords.sentiment",
      label: "Sentiment",
      type: "string",
      description:
        "AI-generated sentiment label. Exact values: very_negative, negative, neutral, positive, very_positive, mixed. Empty until a record is enriched.",
    },
    {
      id: "FeedbackRecords.sentimentScore",
      label: "Sentiment Score",
      type: "number",
      description:
        "Signed sentiment polarity score (-1 to 1, negative to positive), set together with the sentiment label. Empty until a record is enriched.",
    },
    {
      id: "FeedbackRecords.emotions",
      label: "Emotions",
      type: "string",
      description:
        'AI-detected emotions as a comma-separated multi-label set from: joy, anger, sadness, fear, surprise, disgust. Filter a single emotion with "contains". Empty until a record is enriched.',
    },
    {
      id: "FeedbackRecords.userId",
      label: "User ID",
      type: "string",
      description: "Identifier of the user who provided feedback",
    },
    {
      id: "FeedbackRecords.responseId",
      label: "Response ID",
      type: "string",
      description: "Unique identifier linking related feedback records",
    },
    {
      id: "FeedbackRecords.valueNumber",
      label: "Value (Number)",
      type: "number",
      description:
        "Numeric answer value (NPS 0-10, CSAT 1-5, CES 1-5 or 1-7, rating, number). Pair with a fieldType filter to keep scales consistent.",
    },
    {
      id: "FeedbackRecords.valueText",
      label: "Value (Text)",
      type: "string",
      description:
        "Text answer value (open text, or the label of a multiple-choice/categorical answer). Pair with a fieldType filter to keep types consistent.",
    },
    {
      id: "FeedbackRecords.valueBoolean",
      label: "Value (Boolean)",
      type: "boolean",
      description: "Boolean answer value (yes/no). Pair with a fieldType filter.",
    },
    {
      id: "FeedbackRecords.valueDate",
      label: "Value (Date)",
      type: "time",
      description: "Date answer value. Pair with a fieldType filter.",
    },
    {
      id: "FeedbackRecords.collectedAt",
      label: "Collected At",
      type: "time",
      description: "Timestamp when the feedback was collected",
    },
    {
      id: "FeedbackRecords.createdAt",
      label: "Created At",
      type: "time",
      description: "Timestamp when the feedback record was created in Hub",
    },
    {
      id: "FeedbackRecords.updatedAt",
      label: "Updated At",
      type: "time",
      description: "Timestamp when the feedback record was last updated in Hub",
    },
  ] as FieldDefinition[],
  measures: [
    {
      id: "FeedbackRecords.count",
      label: "Count",
      type: "count",
      description: "Total number of feedback responses",
    },
    {
      id: "FeedbackRecords.uniqueRespondents",
      label: "Unique Respondents",
      type: "number",
      description: "Number of unique users who provided feedback",
    },
    {
      id: "FeedbackRecords.uniqueResponses",
      label: "Unique Responses",
      type: "number",
      description: "Number of unique survey submissions",
    },
    {
      id: "FeedbackRecords.npsScore",
      label: "NPS Score",
      type: "number",
      description: "Net Promoter Score: ((Promoters - Detractors) / Total NPS responses) * 100",
    },
    {
      id: "FeedbackRecords.npsAverage",
      label: "NPS Average",
      type: "number",
      description: "Average NPS rating (0-10)",
    },
    {
      id: "FeedbackRecords.promoterCount",
      label: "Promoter Count",
      type: "count",
      description: "Number of NPS promoters (score 9-10)",
    },
    {
      id: "FeedbackRecords.passiveCount",
      label: "Passive Count",
      type: "count",
      description: "Number of NPS passives (score 7-8)",
    },
    {
      id: "FeedbackRecords.detractorCount",
      label: "Detractor Count",
      type: "count",
      description: "Number of NPS detractors (score 0-6)",
    },
    {
      id: "FeedbackRecords.csatScore",
      label: "CSAT Score",
      type: "number",
      description: "CSAT Score: % of CSAT responses rated 4 or 5 (top-2-box on the 1-5 scale)",
    },
    {
      id: "FeedbackRecords.csatAverage",
      label: "CSAT Average",
      type: "number",
      description: "Average CSAT rating (1-5)",
    },
    {
      id: "FeedbackRecords.csatSatisfiedCount",
      label: "CSAT Satisfied Count",
      type: "count",
      description: "Number of satisfied CSAT responses (top-2-box on the 1-5 scale)",
    },
    {
      id: "FeedbackRecords.csatDissatisfiedCount",
      label: "CSAT Dissatisfied Count",
      type: "count",
      description: "Number of dissatisfied CSAT responses (bottom-2-box on the 1-5 scale)",
    },
    {
      id: "FeedbackRecords.csatNeutralCount",
      label: "CSAT Neutral Count",
      type: "count",
      description: "Number of neutral CSAT responses (middle box on the 1-5 scale)",
    },
    {
      id: "FeedbackRecords.csatCount",
      label: "CSAT Count",
      type: "count",
      description: "Number of CSAT responses",
    },
    {
      id: "FeedbackRecords.cesAverage",
      label: "CES Average",
      type: "number",
      description: "Average CES rating (scale is 1-5 or 1-7 depending on the question)",
    },
    {
      id: "FeedbackRecords.cesCount",
      label: "CES Count",
      type: "count",
      description: "Number of CES responses",
    },
    {
      id: "FeedbackRecords.sentimentAverage",
      label: "Sentiment Average",
      type: "number",
      description:
        'Average sentiment score (-1 to 1, negative to positive) across enriched records. "mixed" records score near 0 and are included.',
    },
    ...EMOTION_COUNT_MEASURES,
  ] as MeasureDefinition[],
};

export const FEEDBACK_MEASURE_IDS: string[] = FEEDBACK_FIELDS.measures.map((m) => m.id);

export const FEEDBACK_DIMENSION_IDS: string[] = FEEDBACK_FIELDS.dimensions.map((d) => d.id);

export const FEEDBACK_TIME_DIMENSION_IDS: string[] = FEEDBACK_FIELDS.dimensions
  .filter((d) => d.type === "time")
  .map((d) => d.id);

export const SENTIMENT_DIMENSION_ID = "FeedbackRecords.sentiment";
export const EMOTIONS_DIMENSION_ID = "FeedbackRecords.emotions";

const isSentimentValue = (value: string): value is TSentimentValue =>
  (SENTIMENT_VALUE_ORDER as readonly string[]).includes(value);

const isEmotionValue = (value: string): value is TEmotionValue =>
  (EMOTION_VALUES as readonly string[]).includes(value);

// The label maps are typed against the enum tuples, so extending
// SENTIMENT_VALUE_ORDER / EMOTION_VALUES without adding the matching label is a
// compile error. Keys stay literal t() calls so the i18n scanner can detect them.
const getTranslatedSentimentValueLabel = (value: string, t: TFunction): string | undefined => {
  const labels: Record<TSentimentValue, string> = {
    very_negative: t("workspace.analysis.charts.sentiment_value_very_negative"),
    negative: t("workspace.analysis.charts.sentiment_value_negative"),
    neutral: t("workspace.analysis.charts.sentiment_value_neutral"),
    positive: t("workspace.analysis.charts.sentiment_value_positive"),
    very_positive: t("workspace.analysis.charts.sentiment_value_very_positive"),
    mixed: t("workspace.analysis.charts.sentiment_value_mixed"),
  };
  return isSentimentValue(value) ? labels[value] : undefined;
};

const getTranslatedEmotionValueLabel = (value: string, t: TFunction): string | undefined => {
  const labels: Record<TEmotionValue, string> = {
    joy: t("workspace.analysis.charts.emotion_value_joy"),
    anger: t("workspace.analysis.charts.emotion_value_anger"),
    sadness: t("workspace.analysis.charts.emotion_value_sadness"),
    fear: t("workspace.analysis.charts.emotion_value_fear"),
    surprise: t("workspace.analysis.charts.emotion_value_surprise"),
    disgust: t("workspace.analysis.charts.emotion_value_disgust"),
  };
  return isEmotionValue(value) ? labels[value] : undefined;
};

/**
 * Translate an enum dimension value for display (chart axes, tooltips, tables).
 * Emotions values are comma-separated multi-label sets, so each token is translated
 * individually. Returns undefined for non-enum dimensions or unknown values so callers
 * can fall back to their generic formatting.
 */
export function getTranslatedDimensionValueLabel(
  dimensionId: string,
  value: unknown,
  t: TFunction
): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  if (dimensionId === SENTIMENT_DIMENSION_ID) {
    return getTranslatedSentimentValueLabel(value, t);
  }
  if (dimensionId === EMOTIONS_DIMENSION_ID) {
    const tokens = value.split(",").map((token) => token.trim());
    const labels = tokens.map((token) => getTranslatedEmotionValueLabel(token, t));
    if (labels.includes(undefined)) return undefined;
    return labels.join(", ");
  }
  return undefined;
}

/**
 * Sort chart rows into the sentiment scale order (very_negative → very_positive, mixed
 * last) when the x-axis is the sentiment dimension. Unknown values keep their relative
 * position at the end; other dimensions are returned unchanged.
 */
export function sortRowsByEnumDimension<T extends Record<string, unknown>>(
  rows: T[],
  dimensionId: string
): T[] {
  if (dimensionId !== SENTIMENT_DIMENSION_ID) return rows;
  const order = SENTIMENT_VALUE_ORDER as readonly string[];
  const rank = (row: T): number => {
    const value = row[dimensionId];
    const index = typeof value === "string" ? order.indexOf(value) : -1;
    return index === -1 ? order.length : index;
  };
  return [...rows].sort((a, b) => rank(a) - rank(b));
}

/**
 * String dimensions whose distinct values are low-cardinality enough to offer as a
 * pick-list in the filter UI instead of free-text entry. Picking a stored value
 * guarantees an exact match for the `equals` / `notEquals` operators. High-cardinality
 * free-text dimensions (e.g. valueText) are intentionally excluded.
 */
export const SELECTABLE_VALUE_DIMENSION_IDS = [
  "FeedbackRecords.sourceName",
  "FeedbackRecords.sourceType",
  "FeedbackRecords.language",
  "FeedbackRecords.fieldType",
  "FeedbackRecords.fieldLabel",
  "FeedbackRecords.fieldGroupLabel",
  // Sentiment stores a fixed enum of machine tokens, so picked values are exact-match
  // safe. Emotions is excluded on purpose: values are stored as comma-separated
  // multi-label sets, so `equals` on a picked combination is a trap — filter it with
  // `contains` instead.
  SENTIMENT_DIMENSION_ID,
] as const;

export type TSelectableValueDimensionId = (typeof SELECTABLE_VALUE_DIMENSION_IDS)[number];

export const isSelectableValueDimension = (id: string): id is TSelectableValueDimensionId =>
  (SELECTABLE_VALUE_DIMENSION_IDS as readonly string[]).includes(id);

export type FilterOperator =
  | "equals"
  | "notEquals"
  | "contains"
  | "notContains"
  | "set"
  | "notSet"
  | "gt"
  | "gte"
  | "lt"
  | "lte";

export const FILTER_OPERATORS: Record<string, FilterOperator[]> = {
  string: ["equals", "notEquals", "contains", "notContains", "set", "notSet"],
  number: ["equals", "notEquals", "gt", "gte", "lt", "lte", "set", "notSet"],
  time: ["equals", "notEquals", "gt", "gte", "lt", "lte", "set", "notSet"],
  boolean: ["equals", "notEquals", "set", "notSet"],
};

export const TIME_GRANULARITIES = ["hour", "day", "week", "month", "quarter", "year"] as const;

export type TimeGranularity = (typeof TIME_GRANULARITIES)[number];

export const GRANULARITY_LABELS: Record<string, string> = {
  hour: "Hour",
  day: "Day",
  week: "Week",
  month: "Month",
  quarter: "Quarter",
  year: "Year",
};

export const DATE_PRESETS = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Last 7 days", value: "last 7 days" },
  { label: "Last 30 days", value: "last 30 days" },
  { label: "This month", value: "this month" },
  { label: "Last month", value: "last month" },
  { label: "This quarter", value: "this quarter" },
  { label: "This year", value: "this year" },
] as const;

/**
 * Get filter operators for a given field type.
 */
export function getFilterOperatorsForType(type: "string" | "number" | "time" | "boolean"): FilterOperator[] {
  return FILTER_OPERATORS[type] || FILTER_OPERATORS.string;
}

/**
 * Get field definition by ID.
 */
export function getFieldById(id: string): FieldDefinition | MeasureDefinition | undefined {
  const dimension = FEEDBACK_FIELDS.dimensions.find((d) => d.id === id);
  if (dimension) return dimension;
  return FEEDBACK_FIELDS.measures.find((m) => m.id === id);
}

/**
 * Translate a field/measure ID. Each t() call uses a literal key so the i18n scanner can detect it.
 */
export function getTranslatedFieldLabel(id: string, t: TFunction): string {
  const labels: Record<string, string> = {
    "FeedbackRecords.sourceType": t("workspace.analysis.charts.field_label_source_type"),
    "FeedbackRecords.sourceName": t("workspace.analysis.charts.field_label_source_name"),
    "FeedbackRecords.fieldType": t("workspace.analysis.charts.field_label_field_type"),
    "FeedbackRecords.fieldLabel": t("workspace.analysis.charts.field_label_question"),
    "FeedbackRecords.fieldGroupLabel": t("workspace.analysis.charts.field_label_question_group"),
    "FeedbackRecords.language": t("workspace.analysis.charts.field_label_language"),
    "FeedbackRecords.sentiment": t("workspace.analysis.charts.field_label_sentiment"),
    "FeedbackRecords.sentimentScore": t("workspace.analysis.charts.field_label_sentiment_score"),
    "FeedbackRecords.emotions": t("workspace.analysis.charts.field_label_emotions"),
    "FeedbackRecords.userId": t("workspace.analysis.charts.field_label_user_identifier"),
    "FeedbackRecords.responseId": t("workspace.analysis.charts.field_label_response_id"),
    "FeedbackRecords.valueNumber": t("workspace.analysis.charts.field_label_value_number"),
    "FeedbackRecords.valueText": t("workspace.analysis.charts.field_label_value_text"),
    "FeedbackRecords.valueBoolean": t("workspace.analysis.charts.field_label_value_boolean"),
    "FeedbackRecords.valueDate": t("workspace.analysis.charts.field_label_value_date"),
    "FeedbackRecords.collectedAt": t("workspace.analysis.charts.field_label_collected_at"),
    "FeedbackRecords.createdAt": t("workspace.analysis.charts.field_label_created_at"),
    "FeedbackRecords.updatedAt": t("workspace.analysis.charts.field_label_updated_at"),
    "FeedbackRecords.count": t("workspace.analysis.charts.field_label_count"),
    "FeedbackRecords.uniqueRespondents": t("workspace.analysis.charts.field_label_unique_respondents"),
    "FeedbackRecords.uniqueResponses": t("workspace.analysis.charts.field_label_unique_responses"),
    "FeedbackRecords.npsScore": t("workspace.analysis.charts.field_label_nps_score"),
    "FeedbackRecords.npsAverage": t("workspace.analysis.charts.field_label_nps_average"),
    "FeedbackRecords.promoterCount": t("workspace.analysis.charts.field_label_promoter_count"),
    "FeedbackRecords.passiveCount": t("workspace.analysis.charts.field_label_passive_count"),
    "FeedbackRecords.detractorCount": t("workspace.analysis.charts.field_label_detractor_count"),
    "FeedbackRecords.csatScore": t("workspace.analysis.charts.field_label_csat_score"),
    "FeedbackRecords.csatAverage": t("workspace.analysis.charts.field_label_csat_average"),
    "FeedbackRecords.csatSatisfiedCount": t("workspace.analysis.charts.field_label_csat_satisfied_count"),
    "FeedbackRecords.csatDissatisfiedCount": t(
      "workspace.analysis.charts.field_label_csat_dissatisfied_count"
    ),
    "FeedbackRecords.csatNeutralCount": t("workspace.analysis.charts.field_label_csat_neutral_count"),
    "FeedbackRecords.csatCount": t("workspace.analysis.charts.field_label_csat_count"),
    "FeedbackRecords.cesAverage": t("workspace.analysis.charts.field_label_ces_average"),
    "FeedbackRecords.cesCount": t("workspace.analysis.charts.field_label_ces_count"),
    "FeedbackRecords.sentimentAverage": t("workspace.analysis.charts.field_label_sentiment_average"),
    "FeedbackRecords.joyCount": t("workspace.analysis.charts.field_label_joy_count"),
    "FeedbackRecords.angerCount": t("workspace.analysis.charts.field_label_anger_count"),
    "FeedbackRecords.sadnessCount": t("workspace.analysis.charts.field_label_sadness_count"),
    "FeedbackRecords.fearCount": t("workspace.analysis.charts.field_label_fear_count"),
    "FeedbackRecords.surpriseCount": t("workspace.analysis.charts.field_label_surprise_count"),
    "FeedbackRecords.disgustCount": t("workspace.analysis.charts.field_label_disgust_count"),
  };
  return labels[id] ?? getFieldById(id)?.label ?? id;
}

/**
 * Translate a time granularity value.
 */
export function getTranslatedGranularityLabel(granularity: string, t: TFunction): string {
  const labels: Record<string, string> = {
    hour: t("workspace.analysis.charts.granularity_hour"),
    day: t("workspace.analysis.charts.granularity_day"),
    week: t("workspace.analysis.charts.granularity_week"),
    month: t("workspace.analysis.charts.granularity_month"),
    quarter: t("workspace.analysis.charts.granularity_quarter"),
    year: t("workspace.analysis.charts.granularity_year"),
  };
  return labels[granularity] ?? GRANULARITY_LABELS[granularity] ?? granularity;
}

/**
 * Translate a date preset value.
 */
export function getTranslatedDatePresetLabel(value: string, t: TFunction): string {
  const labels: Record<string, string> = {
    today: t("workspace.analysis.charts.date_preset_today"),
    yesterday: t("workspace.analysis.charts.date_preset_yesterday"),
    "last 7 days": t("workspace.analysis.charts.date_preset_last_7_days"),
    "last 30 days": t("workspace.analysis.charts.date_preset_last_30_days"),
    "this month": t("workspace.analysis.charts.date_preset_this_month"),
    "last month": t("workspace.analysis.charts.date_preset_last_month"),
    "this quarter": t("workspace.analysis.charts.date_preset_this_quarter"),
    "this year": t("workspace.analysis.charts.date_preset_this_year"),
  };
  return labels[value] ?? value;
}

/**
 * Format a Cube.js column key for display (e.g. FeedbackRecords.collectedAt.day → "Day").
 * When `t` is provided, returns translated labels.
 */
export function formatCubeColumnHeader(key: string, t?: TFunction): string {
  const granularity = TIME_GRANULARITIES.find((g) => key.endsWith(`.${g}`));
  if (granularity) {
    return t
      ? getTranslatedGranularityLabel(granularity, t)
      : (GRANULARITY_LABELS[granularity] ?? granularity);
  }
  const field = getFieldById(key);
  if (field) {
    return t ? getTranslatedFieldLabel(key, t) : field.label;
  }
  const lastSegment = key.split(".").pop() ?? key;
  return lastSegment
    .replaceAll(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}
