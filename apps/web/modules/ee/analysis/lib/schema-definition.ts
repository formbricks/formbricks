/**
 * Schema definitions for FeedbackRecords fields.
 * Used by the advanced chart builder to provide field metadata and operators.
 */
import type { TFunction } from "i18next";

export interface FieldDefinition {
  id: string;
  label: string;
  type: "string" | "number" | "time";
  description?: string;
}

export interface MeasureDefinition {
  id: string;
  label: string;
  type: "count" | "number";
  description?: string;
}

export const FEEDBACK_FIELDS = {
  dimensions: [
    {
      id: "FeedbackRecords.sentiment",
      label: "Sentiment",
      type: "string",
      description: "Sentiment extracted from feedback",
    },
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
      id: "FeedbackRecords.emotion",
      label: "Emotion",
      type: "string",
      description: "Emotion extracted from metadata JSONB field",
    },
    {
      id: "FeedbackRecords.userIdentifier",
      label: "User Identifier",
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
      id: "FeedbackRecords.npsValue",
      label: "NPS Value",
      type: "number",
      description: "Raw NPS score value (0-10)",
    },
    {
      id: "FeedbackRecords.collectedAt",
      label: "Collected At",
      type: "time",
      description: "Timestamp when the feedback was collected",
    },
    {
      id: "TopicsUnnested.topic",
      label: "Topic",
      type: "string",
      description: "Individual topic from the topics array",
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
      id: "FeedbackRecords.promoterCount",
      label: "Promoter Count",
      type: "count",
      description: "Number of promoters (NPS score 9-10)",
    },
    {
      id: "FeedbackRecords.detractorCount",
      label: "Detractor Count",
      type: "count",
      description: "Number of detractors (NPS score 0-6)",
    },
    {
      id: "FeedbackRecords.passiveCount",
      label: "Passive Count",
      type: "count",
      description: "Number of passives (NPS score 7-8)",
    },
    {
      id: "FeedbackRecords.npsScore",
      label: "NPS Score",
      type: "number",
      description: "Net Promoter Score: ((Promoters - Detractors) / Total) * 100",
    },
    {
      id: "FeedbackRecords.averageScore",
      label: "Average Score",
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

/**
 * Translate a field/measure ID. Each t() call uses a literal key so the i18n scanner can detect it.
 */
export function getTranslatedFieldLabel(id: string, t: TFunction): string {
  const labels: Record<string, string> = {
    "FeedbackRecords.sentiment": t("environments.analysis.charts.field_label_sentiment"),
    "FeedbackRecords.sourceType": t("environments.analysis.charts.field_label_source_type"),
    "FeedbackRecords.sourceName": t("environments.analysis.charts.field_label_source_name"),
    "FeedbackRecords.fieldType": t("environments.analysis.charts.field_label_field_type"),
    "FeedbackRecords.emotion": t("environments.analysis.charts.field_label_emotion"),
    "FeedbackRecords.userIdentifier": t("environments.analysis.charts.field_label_user_identifier"),
    "FeedbackRecords.responseId": t("environments.analysis.charts.field_label_response_id"),
    "FeedbackRecords.npsValue": t("environments.analysis.charts.field_label_nps_value"),
    "FeedbackRecords.collectedAt": t("environments.analysis.charts.field_label_collected_at"),
    "TopicsUnnested.topic": t("environments.analysis.charts.field_label_topic"),
    "FeedbackRecords.count": t("environments.analysis.charts.field_label_count"),
    "FeedbackRecords.promoterCount": t("environments.analysis.charts.field_label_promoter_count"),
    "FeedbackRecords.detractorCount": t("environments.analysis.charts.field_label_detractor_count"),
    "FeedbackRecords.passiveCount": t("environments.analysis.charts.field_label_passive_count"),
    "FeedbackRecords.npsScore": t("environments.analysis.charts.field_label_nps_score"),
    "FeedbackRecords.averageScore": t("environments.analysis.charts.field_label_average_score"),
  };
  return labels[id] ?? getFieldById(id)?.label ?? id;
}

/**
 * Translate a time granularity value.
 */
export function getTranslatedGranularityLabel(granularity: string, t: TFunction): string {
  const labels: Record<string, string> = {
    hour: t("environments.analysis.charts.granularity_hour"),
    day: t("environments.analysis.charts.granularity_day"),
    week: t("environments.analysis.charts.granularity_week"),
    month: t("environments.analysis.charts.granularity_month"),
    quarter: t("environments.analysis.charts.granularity_quarter"),
    year: t("environments.analysis.charts.granularity_year"),
  };
  return labels[granularity] ?? GRANULARITY_LABELS[granularity] ?? granularity;
}

/**
 * Translate a date preset value.
 */
export function getTranslatedDatePresetLabel(value: string, t: TFunction): string {
  const labels: Record<string, string> = {
    today: t("environments.analysis.charts.date_preset_today"),
    yesterday: t("environments.analysis.charts.date_preset_yesterday"),
    "last 7 days": t("environments.analysis.charts.date_preset_last_7_days"),
    "last 30 days": t("environments.analysis.charts.date_preset_last_30_days"),
    "this month": t("environments.analysis.charts.date_preset_this_month"),
    "last month": t("environments.analysis.charts.date_preset_last_month"),
    "this quarter": t("environments.analysis.charts.date_preset_this_quarter"),
    "this year": t("environments.analysis.charts.date_preset_this_year"),
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
