/**
 * Schema definitions for FeedbackRecords fields.
 * Used by the advanced chart builder to provide field metadata and operators.
 */

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
 * Format a Cube.js column key for display (e.g. FeedbackRecords.collectedAt.day → "Day").
 */
export function formatCubeColumnHeader(key: string): string {
  const granularity = TIME_GRANULARITIES.find((g) => key.endsWith(`.${g}`));
  if (granularity) {
    return GRANULARITY_LABELS[granularity] ?? granularity;
  }
  const field = getFieldById(key);
  if (field) {
    return field.label;
  }
  const lastSegment = key.split(".").pop() ?? key;
  return lastSegment
    .replaceAll(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}
