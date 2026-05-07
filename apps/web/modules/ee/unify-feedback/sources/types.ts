import { TFunction } from "i18next";
import { z } from "zod";
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
  },
  {
    id: "source_type",
    name: "Source Type",
    type: "string",
    required: true,
    description: "Type of source (e.g., survey, review, support)",
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
    id: "submission_id",
    name: "Submission ID",
    type: "string",
    required: false,
    description:
      "Optional. Map to a stable column (e.g. order_id, ticket_id) to enable idempotent re-imports. Auto-generated UUID per row if unmapped.",
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
    id: "user_id",
    name: "User Identifier",
    type: "string",
    required: false,
    description: "Anonymous user ID for tracking (hashed, never PII)",
  },
];

// Synthetic CSV-only target field. The CSV mapping UI exposes a single `response_value` control
// instead of the four `value_*` targets; csv-transform.ts routes it to the correct value_* based
// on the row's resolved field_type.
export const CSV_RESPONSE_VALUE_TARGET: TTargetField = {
  id: "response_value",
  name: "Response",
  type: "string",
  required: true,
  description:
    "The user's actual answer or value. We'll store it in the right format (text, number, boolean, or date) based on Field Type.",
};

// Target fields visible in the CSV mapping UI. Excludes tenant_id (backend-backfilled),
// source_type (static "csv", hidden) and the four value_* targets (replaced by response_value).
const CSV_HIDDEN_TARGET_IDS = [
  "tenant_id",
  "source_type",
  "value_text",
  "value_number",
  "value_boolean",
  "value_date",
];
export const CSV_TARGET_FIELDS: TTargetField[] = [
  ...FEEDBACK_RECORD_FIELDS.filter((f) => CSV_HIDDEN_TARGET_IDS.every((id) => f.id !== id)),
  CSV_RESPONSE_VALUE_TARGET,
];

export const CSV_FIELD_GROUPS = {
  basic: ["collected_at", "field_id", "field_label", "field_type", "response_value"],
  sourceContext: ["source_id", "source_name"],
  advanced: [
    "submission_id",
    "field_group_id",
    "field_group_label",
    "language",
    "user_identifier",
    "metadata",
  ],
} as const;

// Mappings always merged into a CSV connector's persisted mappings on save. Keeps internal
// fields off the wire from the user.
export const CSV_HIDDEN_STATIC_MAPPINGS: TFieldMapping[] = [
  { targetFieldId: "source_type", staticValue: "csv" },
];

// Fields the CSV UI requires the user to resolve before saving. collected_at is excluded
// because it falls back to "$now" automatically.
export const CSV_REQUIRED_UI_FIELDS = ["field_id", "field_label", "field_type", "response_value"];

export const SAMPLE_CSV_COLUMNS = "timestamp,customer_id,rating,feedback_text,category";

export const MAX_CSV_VALUES = {
  FILE_SIZE: 2_097_152, // 2MB (2 * 1024 * 1024)
  RECORDS: 1_000, // 1,000 records
} as const;

export const createFeedbackCSVDataSchema = (t: TFunction) =>
  z
    .array(z.record(z.string(), z.string()))
    .min(1, { message: t("workspace.unify.csv_at_least_one_row") })
    .max(MAX_CSV_VALUES.RECORDS, {
      message: t("workspace.unify.csv_max_records", {
        max: MAX_CSV_VALUES.RECORDS.toLocaleString(),
      }),
    })
    .superRefine((rows, ctx) => {
      const localeSort = (a: string, b: string) => a.localeCompare(b);
      const firstRowKeys = Object.keys(rows[0]).sort(localeSort).join(",");

      for (let i = 1; i < rows.length; i++) {
        const rowKeys = Object.keys(rows[i]).sort(localeSort).join(",");
        if (rowKeys !== firstRowKeys) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t("workspace.unify.csv_inconsistent_columns", { row: (i + 1).toString() }),
          });
          return;
        }
      }

      const emptyHeaders = Object.keys(rows[0]).filter((k) => k.trim() === "");
      if (emptyHeaders.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("workspace.unify.csv_empty_column_headers"),
        });
      }
    });

export type TFeedbackCSVData = z.infer<ReturnType<typeof createFeedbackCSVDataSchema>>;

export type TCreateConnectorStep = "selectType" | "mapping";

export const ZFormbricksConnectorForm = z.object({
  sourceName: z.string().trim().min(1, "CONNECTOR_NAME_REQUIRED"),
  surveyId: z.string().min(1, "CONNECTOR_SURVEY_REQUIRED"),
  selectedQuestionIds: z.array(z.string()).min(1, "CONNECTOR_QUESTIONS_REQUIRED"),
  importHistorical: z.boolean(),
});

export type TFormbricksConnectorForm = z.infer<typeof ZFormbricksConnectorForm>;

export const getTranslatedConnectorError = (errorCode: string, t: TFunction): string => {
  switch (errorCode) {
    case "CONNECTOR_NAME_DUPLICATE":
      return t("workspace.unify.error_connector_name_duplicate");
    case "CONNECTOR_FORMBRICKS_MAPPING_DUPLICATE":
      return t("workspace.unify.error_connector_formbricks_mapping_duplicate");
    case "CONNECTOR_FIELD_MAPPING_DUPLICATE":
      return t("workspace.unify.error_connector_field_mapping_duplicate");
    case "CONNECTOR_NAME_REQUIRED":
      return t("workspace.unify.error_connector_name_required");
    case "CONNECTOR_SURVEY_REQUIRED":
      return t("workspace.unify.error_connector_survey_required");
    case "CONNECTOR_QUESTIONS_REQUIRED":
      return t("workspace.unify.error_connector_questions_required");
    default:
      return errorCode;
  }
};
