import { THubFieldType, ZHubFieldType } from "@formbricks/types/connector";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";

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

export interface TFieldMapping {
  targetFieldId: string;
  sourceFieldId?: string;
  staticValue?: string;
}

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

export type TCreateConnectorStep = "selectType" | "mapping";
