import { TFunction } from "i18next";
import { THubFieldType, ZHubFieldType } from "@formbricks/types/connector";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";

// Source types for the feedback source connections
export type TSourceType = "formbricks" | "webhook" | "email" | "csv" | "slack";

export interface TSourceOption {
  id: TSourceType;
  name: string;
  description: string;
  disabled: boolean;
  badge?: { text: string; type: "success" | "gray" | "warning" };
}

export const getSourceOptions = (t: TFunction): TSourceOption[] => [
  {
    id: "formbricks",
    name: t("environments.unify.formbricks_surveys"),
    description: t("environments.unify.source_connect_formbricks_description"),
    disabled: false,
  },
  {
    id: "webhook",
    name: t("environments.unify.webhook"),
    description: t("environments.unify.source_connect_webhook_description"),
    disabled: true,
    badge: { text: t("environments.unify.coming_soon"), type: "gray" },
  },
  {
    id: "email",
    name: t("environments.unify.email"),
    description: t("environments.unify.source_connect_email_description"),
    disabled: true,
    badge: { text: t("environments.unify.coming_soon"), type: "gray" },
  },
  {
    id: "csv",
    name: t("environments.unify.csv_import"),
    description: t("environments.unify.source_connect_csv_description"),
    disabled: false,
  },
  {
    id: "slack",
    name: t("environments.unify.slack_message"),
    description: t("environments.unify.source_connect_slack_description"),
    disabled: true,
    badge: { text: t("environments.unify.coming_soon"), type: "gray" },
  },
];

// Unify Survey types that work with real survey data
export interface TUnifySurveyElement {
  id: string;
  type: TSurveyElementTypeEnum;
  headline: string;
  required: boolean;
}

export interface TUnifySurvey {
  id: string;
  name: string;
  status: "draft" | "active" | "paused" | "completed";
  elements: TUnifySurveyElement[];
  createdAt: Date;
}

// Field mapping types
export interface TFieldMapping {
  targetFieldId: string;
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

// Field types for the Hub target schema
export type TTargetFieldType = "string" | "enum" | "timestamp" | "float64" | "boolean" | "jsonb" | "string[]";

export interface TTargetField {
  id: string;
  name: string;
  type: TTargetFieldType;
  required: boolean;
  description: string;
  enumValues?: THubFieldType[];
  exampleStaticValues?: string[];
}

export interface TSourceField {
  id: string;
  name: string;
  type: string;
  sampleValue?: string;
}

// Target fields based on the FeedbackRecord Hub schema
export const FEEDBACK_RECORD_FIELDS: TTargetField[] = [
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
    enumValues: ZHubFieldType.options,
  },
  {
    id: "tenant_id",
    name: "Tenant ID",
    type: "string",
    required: false,
    description: "Tenant/organization identifier for multi-tenant deployments",
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
    id: "field_group_id",
    name: "Field Group ID",
    type: "string",
    required: false,
    description: "Stable identifier grouping related fields (for ranking, matrix, grid questions)",
  },
  {
    id: "field_group_label",
    name: "Field Group Label",
    type: "string",
    required: false,
    description: "Human-readable question text for the group",
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

export const SAMPLE_CSV_COLUMNS = "timestamp,customer_id,rating,feedback_text,category";

// AI suggested mappings per source type
export const AI_SUGGESTED_MAPPINGS: Partial<
  Record<
    TSourceType,
    {
      fieldMappings: Record<string, string>;
      staticValues: Record<string, string>;
    }
  >
> = {
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
};

// Modal step types
export type TCreateSourceStep = "selectType" | "mapping";
