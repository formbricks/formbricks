/**
 * Schema definitions for FeedbackRecords fields.
 * Used by the advanced chart builder to provide field metadata and operators.
 */

export interface FieldDefinition {
  id: string;
  label: string;
  labelKey: string;
  type: "string" | "number" | "time";
  description?: string;
}

export interface MeasureDefinition {
  id: string;
  label: string;
  labelKey: string;
  type: "count" | "number";
  description?: string;
}

export const FEEDBACK_FIELDS = {
  dimensions: [
    {
      id: "FeedbackRecords.sentiment",
      label: "Sentiment",
      labelKey: "environments.analysis.charts.field_label_sentiment",
      type: "string",
      description: "Sentiment extracted from feedback",
    },
    {
      id: "FeedbackRecords.sourceType",
      label: "Source Type",
      labelKey: "environments.analysis.charts.field_label_source_type",
      type: "string",
      description: "Source type of the feedback (e.g., nps_campaign, survey)",
    },
    {
      id: "FeedbackRecords.sourceName",
      label: "Source Name",
      labelKey: "environments.analysis.charts.field_label_source_name",
      type: "string",
      description: "Human-readable name of the source",
    },
    {
      id: "FeedbackRecords.fieldType",
      label: "Field Type",
      labelKey: "environments.analysis.charts.field_label_field_type",
      type: "string",
      description: "Type of feedback field (e.g., nps, text, rating)",
    },
    {
      id: "FeedbackRecords.emotion",
      label: "Emotion",
      labelKey: "environments.analysis.charts.field_label_emotion",
      type: "string",
      description: "Emotion extracted from metadata JSONB field",
    },
    {
      id: "FeedbackRecords.userIdentifier",
      label: "User Identifier",
      labelKey: "environments.analysis.charts.field_label_user_identifier",
      type: "string",
      description: "Identifier of the user who provided feedback",
    },
    {
      id: "FeedbackRecords.responseId",
      label: "Response ID",
      labelKey: "environments.analysis.charts.field_label_response_id",
      type: "string",
      description: "Unique identifier linking related feedback records",
    },
    {
      id: "FeedbackRecords.npsValue",
      label: "NPS Value",
      labelKey: "environments.analysis.charts.field_label_nps_value",
      type: "number",
      description: "Raw NPS score value (0-10)",
    },
    {
      id: "FeedbackRecords.collectedAt",
      label: "Collected At",
      labelKey: "environments.analysis.charts.field_label_collected_at",
      type: "time",
      description: "Timestamp when the feedback was collected",
    },
    {
      id: "TopicsUnnested.topic",
      label: "Topic",
      labelKey: "environments.analysis.charts.field_label_topic",
      type: "string",
      description: "Individual topic from the topics array",
    },
  ] as FieldDefinition[],
  measures: [
    {
      id: "FeedbackRecords.count",
      label: "Count",
      labelKey: "environments.analysis.charts.field_label_count",
      type: "count",
      description: "Total number of feedback responses",
    },
    {
      id: "FeedbackRecords.promoterCount",
      label: "Promoter Count",
      labelKey: "environments.analysis.charts.field_label_promoter_count",
      type: "count",
      description: "Number of promoters (NPS score 9-10)",
    },
    {
      id: "FeedbackRecords.detractorCount",
      label: "Detractor Count",
      labelKey: "environments.analysis.charts.field_label_detractor_count",
      type: "count",
      description: "Number of detractors (NPS score 0-6)",
    },
    {
      id: "FeedbackRecords.passiveCount",
      label: "Passive Count",
      labelKey: "environments.analysis.charts.field_label_passive_count",
      type: "count",
      description: "Number of passives (NPS score 7-8)",
    },
    {
      id: "FeedbackRecords.npsScore",
      label: "NPS Score",
      labelKey: "environments.analysis.charts.field_label_nps_score",
      type: "number",
      description: "Net Promoter Score: ((Promoters - Detractors) / Total) * 100",
    },
    {
      id: "FeedbackRecords.averageScore",
      label: "Average Score",
      labelKey: "environments.analysis.charts.field_label_average_score",
      type: "number",
      description: "Average NPS score",
    },
  ] as MeasureDefinition[],
};

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
};

export const TIME_GRANULARITIES = ["hour", "day", "week", "month", "quarter", "year"] as const;

export type TimeGranularity = (typeof TIME_GRANULARITIES)[number];

export const DATE_PRESETS = [
  { label: "Today", labelKey: "environments.analysis.charts.date_preset_today", value: "today" },
  {
    label: "Yesterday",
    labelKey: "environments.analysis.charts.date_preset_yesterday",
    value: "yesterday",
  },
  {
    label: "Last 7 days",
    labelKey: "environments.analysis.charts.date_preset_last_7_days",
    value: "last 7 days",
  },
  {
    label: "Last 30 days",
    labelKey: "environments.analysis.charts.date_preset_last_30_days",
    value: "last 30 days",
  },
  {
    label: "This month",
    labelKey: "environments.analysis.charts.date_preset_this_month",
    value: "this month",
  },
  {
    label: "Last month",
    labelKey: "environments.analysis.charts.date_preset_last_month",
    value: "last month",
  },
  {
    label: "This quarter",
    labelKey: "environments.analysis.charts.date_preset_this_quarter",
    value: "this quarter",
  },
  {
    label: "This year",
    labelKey: "environments.analysis.charts.date_preset_this_year",
    value: "this year",
  },
] as const;

/**
 * Get filter operators for a given field type.
 */
export function getFilterOperatorsForType(type: "string" | "number" | "time"): FilterOperator[] {
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

const GRANULARITY_LABEL_KEYS: Record<string, string> = {
  hour: "environments.analysis.charts.granularity_hour",
  day: "environments.analysis.charts.granularity_day",
  week: "environments.analysis.charts.granularity_week",
  month: "environments.analysis.charts.granularity_month",
  quarter: "environments.analysis.charts.granularity_quarter",
  year: "environments.analysis.charts.granularity_year",
};

const GRANULARITY_LABELS_FALLBACK: Record<string, string> = {
  hour: "Hour",
  day: "Day",
  week: "Week",
  month: "Month",
  quarter: "Quarter",
  year: "Year",
};

/**
 * Get a translated granularity label. Falls back to English when `t` is not provided.
 */
export function getGranularityLabel(granularity: string, t?: (key: string) => string): string {
  if (t && GRANULARITY_LABEL_KEYS[granularity]) {
    return t(GRANULARITY_LABEL_KEYS[granularity]);
  }
  return GRANULARITY_LABELS_FALLBACK[granularity] ?? granularity;
}

/**
 * Format a Cube.js column key for display (e.g. FeedbackRecords.collectedAt.day → "Day").
 * When `t` is provided, returns translated labels.
 */
export function formatCubeColumnHeader(key: string, t?: (key: string) => string): string {
  const granularity = TIME_GRANULARITIES.find((g) => key.endsWith(`.${g}`));
  if (granularity) {
    return getGranularityLabel(granularity, t);
  }
  const field = getFieldById(key);
  if (field) {
    return t ? t(field.labelKey) : field.label;
  }
  const lastSegment = key.split(".").pop() ?? key;
  return lastSegment
    .replaceAll(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}
