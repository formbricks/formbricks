// Source types for the feedback source connections
export type TSourceType = "formbricks" | "webhook" | "email" | "csv" | "slack";

export interface TSourceOption {
  id: TSourceType;
  name: string;
  description: string;
  disabled: boolean;
  badge?: {
    text: string;
    type: "success" | "gray" | "warning";
  };
}

export const SOURCE_OPTIONS: TSourceOption[] = [
  {
    id: "formbricks",
    name: "Formbricks Surveys",
    description: "Connect feedback from your Formbricks surveys",
    disabled: false,
  },
  {
    id: "webhook",
    name: "Webhook",
    description: "Receive feedback via webhook with custom mapping",
    disabled: false,
  },
  {
    id: "email",
    name: "Email",
    description: "Import feedback from email with custom mapping",
    disabled: false,
  },
  {
    id: "csv",
    name: "CSV Import",
    description: "Import feedback from CSV files",
    disabled: false,
  },
  {
    id: "slack",
    name: "Slack Message",
    description: "Connect feedback from Slack channels",
    disabled: true,
    badge: {
      text: "Coming soon",
      type: "gray",
    },
  },
];

// Formbricks Survey types for survey selection
export interface TFormbricksSurveyQuestion {
  id: string;
  type: "openText" | "rating" | "nps" | "csat" | "multipleChoice" | "checkbox" | "date";
  headline: string;
  required: boolean;
}

export interface TFormbricksSurvey {
  id: string;
  name: string;
  status: "draft" | "active" | "paused" | "completed";
  responseCount: number;
  questions: TFormbricksSurveyQuestion[];
  createdAt: Date;
}

// Mock surveys for POC
export const MOCK_FORMBRICKS_SURVEYS: TFormbricksSurvey[] = [
  {
    id: "survey_nps_q1",
    name: "Q1 2024 NPS Survey",
    status: "active",
    responseCount: 1247,
    createdAt: new Date("2024-01-15"),
    questions: [
      { id: "q_nps", type: "nps", headline: "How likely are you to recommend us?", required: true },
      {
        id: "q_reason",
        type: "openText",
        headline: "What's the main reason for your score?",
        required: false,
      },
      {
        id: "q_improve",
        type: "openText",
        headline: "What could we do to improve?",
        required: false,
      },
    ],
  },
  {
    id: "survey_product_feedback",
    name: "Product Feedback Survey",
    status: "active",
    responseCount: 523,
    createdAt: new Date("2024-02-01"),
    questions: [
      {
        id: "q_satisfaction",
        type: "rating",
        headline: "How satisfied are you with the product?",
        required: true,
      },
      {
        id: "q_features",
        type: "multipleChoice",
        headline: "Which features do you use most?",
        required: true,
      },
      {
        id: "q_missing",
        type: "openText",
        headline: "What features are you missing?",
        required: false,
      },
      { id: "q_feedback", type: "openText", headline: "Any other feedback?", required: false },
    ],
  },
  {
    id: "survey_onboarding",
    name: "Onboarding Experience",
    status: "active",
    responseCount: 89,
    createdAt: new Date("2024-03-10"),
    questions: [
      { id: "q_easy", type: "csat", headline: "How easy was the onboarding process?", required: true },
      {
        id: "q_time",
        type: "multipleChoice",
        headline: "How long did onboarding take?",
        required: true,
      },
      {
        id: "q_help",
        type: "checkbox",
        headline: "Which resources did you find helpful?",
        required: false,
      },
      {
        id: "q_suggestions",
        type: "openText",
        headline: "Any suggestions for improvement?",
        required: false,
      },
    ],
  },
  {
    id: "survey_support",
    name: "Support Satisfaction",
    status: "paused",
    responseCount: 312,
    createdAt: new Date("2024-01-20"),
    questions: [
      {
        id: "q_support_rating",
        type: "rating",
        headline: "How would you rate your support experience?",
        required: true,
      },
      {
        id: "q_resolved",
        type: "multipleChoice",
        headline: "Was your issue resolved?",
        required: true,
      },
      { id: "q_comments", type: "openText", headline: "Additional comments", required: false },
    ],
  },
];

// Helper to get question type label
export function getQuestionTypeLabel(type: TFormbricksSurveyQuestion["type"]): string {
  switch (type) {
    case "openText":
      return "Open Text";
    case "rating":
      return "Rating";
    case "nps":
      return "NPS";
    case "csat":
      return "CSAT";
    case "multipleChoice":
      return "Multiple Choice";
    case "checkbox":
      return "Checkbox";
    case "date":
      return "Date";
    default:
      return type;
  }
}

// Helper to map question type to FeedbackRecord field_type
export function questionTypeToFieldType(type: TFormbricksSurveyQuestion["type"]): TFeedbackRecordFieldType {
  switch (type) {
    case "openText":
      return "text";
    case "rating":
      return "rating";
    case "nps":
      return "nps";
    case "csat":
      return "csat";
    case "multipleChoice":
    case "checkbox":
      return "categorical";
    case "date":
      return "date";
    default:
      return "text";
  }
}

// Field mapping types - supports both source field mapping and static values
export interface TFieldMapping {
  targetFieldId: string;
  // Either map from a source field OR set a static value
  sourceFieldId?: string;
  staticValue?: string;
}

export interface TSourceConnection {
  id: string;
  name: string;
  type: TSourceType;
  mappings: TFieldMapping[];
  createdAt: Date;
  updatedAt: Date;
}

// FeedbackRecord field types (enum values for field_type)
export type TFeedbackRecordFieldType =
  | "text"
  | "categorical"
  | "nps"
  | "csat"
  | "ces"
  | "rating"
  | "number"
  | "boolean"
  | "date";

// Field types for the Hub schema
export type TTargetFieldType = "string" | "enum" | "timestamp" | "float64" | "boolean" | "jsonb" | "string[]";

export interface TTargetField {
  id: string;
  name: string;
  type: TTargetFieldType;
  required: boolean;
  description: string;
  // For enum fields, the possible values
  enumValues?: string[];
  // For string fields, example static values that could be set
  exampleStaticValues?: string[];
}

export interface TSourceField {
  id: string;
  name: string;
  type: string;
  sampleValue?: string;
}

// Enum values for field_type
export const FIELD_TYPE_ENUM_VALUES: TFeedbackRecordFieldType[] = [
  "text",
  "categorical",
  "nps",
  "csat",
  "ces",
  "rating",
  "number",
  "boolean",
  "date",
];

// Target fields based on the FeedbackRecord schema
export const FEEDBACK_RECORD_FIELDS: TTargetField[] = [
  // Required fields
  {
    id: "collected_at",
    name: "Collected At",
    type: "timestamp",
    required: true,
    description: "When the feedback was originally collected",
    exampleStaticValues: ["$now"],
  },
  {
    id: "source_type",
    name: "Source Type",
    type: "string",
    required: true,
    description: "Type of source (e.g., survey, review, support)",
    exampleStaticValues: ["survey", "review", "support", "email", "qualtrics", "typeform", "intercom"],
  },
  {
    id: "field_id",
    name: "Field ID",
    type: "string",
    required: true,
    description: "Unique question/field identifier",
  },
  {
    id: "field_type",
    name: "Field Type",
    type: "enum",
    required: true,
    description: "Data type (text, nps, csat, rating, etc.)",
    enumValues: FIELD_TYPE_ENUM_VALUES,
  },
  // Optional fields
  {
    id: "tenant_id",
    name: "Tenant ID",
    type: "string",
    required: false,
    description: "Tenant/organization identifier for multi-tenant deployments",
  },
  {
    id: "response_id",
    name: "Response ID",
    type: "string",
    required: false,
    description: "Groups multiple answers from a single submission",
  },
  {
    id: "source_id",
    name: "Source ID",
    type: "string",
    required: false,
    description: "Reference to survey/form/ticket/review ID",
  },
  {
    id: "source_name",
    name: "Source Name",
    type: "string",
    required: false,
    description: "Human-readable source name for display",
    exampleStaticValues: ["Product Feedback", "Customer Support", "NPS Survey", "Qualtrics Import"],
  },
  {
    id: "field_label",
    name: "Field Label",
    type: "string",
    required: false,
    description: "Question text or field label for display",
  },
  {
    id: "value_text",
    name: "Value (Text)",
    type: "string",
    required: false,
    description: "Text responses (feedback, comments, open-ended answers)",
  },
  {
    id: "value_number",
    name: "Value (Number)",
    type: "float64",
    required: false,
    description: "Numeric responses (ratings, scores, NPS, CSAT)",
  },
  {
    id: "value_boolean",
    name: "Value (Boolean)",
    type: "boolean",
    required: false,
    description: "Yes/no responses",
  },
  {
    id: "value_date",
    name: "Value (Date)",
    type: "timestamp",
    required: false,
    description: "Date/datetime responses",
  },
  {
    id: "metadata",
    name: "Metadata",
    type: "jsonb",
    required: false,
    description: "Flexible context (device, location, campaign, custom fields)",
  },
  {
    id: "language",
    name: "Language",
    type: "string",
    required: false,
    description: "ISO 639-1 language code (e.g., en, de, fr)",
    exampleStaticValues: ["en", "de", "fr", "es", "pt", "ja", "zh"],
  },
  {
    id: "user_identifier",
    name: "User Identifier",
    type: "string",
    required: false,
    description: "Anonymous user ID for tracking (hashed, never PII)",
  },
];

// Sample webhook payload for testing
export const SAMPLE_WEBHOOK_PAYLOAD = {
  id: "resp_12345",
  timestamp: "2024-01-15T10:30:00Z",
  survey_id: "survey_abc",
  survey_name: "Product Feedback Survey",
  question_id: "q1",
  question_text: "How satisfied are you with our product?",
  answer_type: "rating",
  answer_value: 4,
  user_id: "user_xyz",
  metadata: {
    device: "mobile",
    browser: "Safari",
  },
};

// Email source fields (simplified)
export const EMAIL_SOURCE_FIELDS: TSourceField[] = [
  { id: "subject", name: "Subject", type: "string", sampleValue: "Feature Request: Dark Mode" },
  {
    id: "body",
    name: "Body (Text)",
    type: "string",
    sampleValue: "I would love to see a dark mode option...",
  },
];

// CSV sample columns
export const SAMPLE_CSV_COLUMNS = "timestamp,customer_id,rating,feedback_text,category";

// Helper function to parse payload to source fields
export function parsePayloadToFields(payload: Record<string, unknown>): TSourceField[] {
  const fields: TSourceField[] = [];

  function extractFields(obj: Record<string, unknown>, prefix = ""): void {
    for (const [key, value] of Object.entries(obj)) {
      const fieldId = prefix ? `${prefix}.${key}` : key;
      const fieldName = prefix ? `${prefix}.${key}` : key;

      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        extractFields(value as Record<string, unknown>, fieldId);
      } else {
        let type = "string";
        if (typeof value === "number") type = "number";
        if (typeof value === "boolean") type = "boolean";
        if (Array.isArray(value)) type = "array";

        fields.push({
          id: fieldId,
          name: fieldName,
          type,
          sampleValue: String(value),
        });
      }
    }
  }

  extractFields(payload);
  return fields;
}

// Helper function to parse CSV columns to source fields
export function parseCSVColumnsToFields(columns: string): TSourceField[] {
  return columns.split(",").map((col) => {
    const trimmedCol = col.trim();
    return {
      id: trimmedCol,
      name: trimmedCol,
      type: "string",
      sampleValue: `Sample ${trimmedCol}`,
    };
  });
}

// AI suggested mappings for different source types
// Maps source field IDs to target field IDs
export interface TAISuggestedMapping {
  // Maps source field ID -> target field ID
  fieldMappings: Record<string, string>;
  // Static values to set on target fields
  staticValues: Record<string, string>;
}

export const AI_SUGGESTED_MAPPINGS: Record<TSourceType, TAISuggestedMapping> = {
  webhook: {
    fieldMappings: {
      timestamp: "collected_at",
      survey_id: "source_id",
      survey_name: "source_name",
      question_id: "field_id",
      question_text: "field_label",
      answer_value: "value_number",
      user_id: "user_identifier",
    },
    staticValues: {
      source_type: "survey",
      field_type: "rating",
    },
  },
  email: {
    fieldMappings: {
      subject: "field_label",
      body: "value_text",
    },
    staticValues: {
      collected_at: "$now",
      source_type: "email",
      field_type: "text",
    },
  },
  csv: {
    fieldMappings: {
      timestamp: "collected_at",
      customer_id: "user_identifier",
      rating: "value_number",
      feedback_text: "value_text",
      category: "field_label",
    },
    staticValues: {
      source_type: "survey",
      field_type: "rating",
    },
  },
  formbricks: {
    fieldMappings: {},
    staticValues: {
      source_type: "survey",
    },
  },
  slack: {
    fieldMappings: {},
    staticValues: {
      source_type: "support",
      field_type: "text",
    },
  },
};

// Modal step types
export type TCreateSourceStep = "selectType" | "mapping";
