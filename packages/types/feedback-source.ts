import { z } from "zod";
import { TSurveyElementTypeEnum } from "./surveys/constants";

// Feedback source type enum
export const ZFeedbackSourceType = z.enum(["formbricks_survey", "csv"]);
export type TFeedbackSourceType = z.infer<typeof ZFeedbackSourceType>;

// Feedback source status enum
export const ZFeedbackSourceStatus = z.enum(["active", "paused", "error"]);
export type TFeedbackSourceStatus = z.infer<typeof ZFeedbackSourceStatus>;

// Hub field types (from Hub OpenAPI spec)
export const ZHubFieldType = z.enum([
  "text",
  "categorical",
  "nps",
  "csat",
  "ces",
  "rating",
  "number",
  "boolean",
  "date",
]);
export type THubFieldType = z.infer<typeof ZHubFieldType>;

// Hub target fields for mapping.
// `response_value` is a CSV-only synthetic id stored in FeedbackSourceFieldMapping; csv-transform.ts
// resolves it to the appropriate value_* target before any Hub write — the Hub never sees it.
export const ZHubTargetField = z.enum([
  "collected_at",
  "source_type",
  "field_id",
  "field_type",
  "field_label",
  "field_group_id",
  "field_group_label",
  "tenant_id",
  "source_id",
  "source_name",
  "value_text",
  "value_number",
  "value_boolean",
  "value_date",
  "metadata",
  "language",
  "user_id",
  "submission_id",
  "response_value",
]);
export type THubTargetField = z.infer<typeof ZHubTargetField>;

// Base feedback source schema
export const ZFeedbackSource = z.object({
  id: z.cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string().min(1),
  type: ZFeedbackSourceType,
  status: ZFeedbackSourceStatus,
  workspaceId: z.cuid2(),
  feedbackDirectoryId: z.cuid2(),
  lastSyncAt: z.date().nullable(),
  createdBy: z.string().nullable(),
});
export type TFeedbackSource = z.infer<typeof ZFeedbackSource>;

// Formbricks element mapping
export const ZFeedbackSourceFormbricksMapping = z.object({
  id: z.cuid2(),
  createdAt: z.date(),
  feedbackSourceId: z.cuid2(),
  workspaceId: z.cuid2(),
  surveyId: z.cuid2(),
  elementId: z.string(),
  hubFieldType: ZHubFieldType,
  customFieldLabel: z.string().nullable(),
});
export type TFeedbackSourceFormbricksMapping = z.infer<typeof ZFeedbackSourceFormbricksMapping>;

export const ZFeedbackSourceFieldMapping = z.object({
  id: z.cuid2(),
  createdAt: z.date(),
  feedbackSourceId: z.cuid2(),
  workspaceId: z.cuid2(),
  sourceFieldId: z.string(),
  targetFieldId: ZHubTargetField,
  staticValue: z.string().nullable(),
});
export type TFeedbackSourceFieldMapping = z.infer<typeof ZFeedbackSourceFieldMapping>;

export const ZFeedbackSourceWithMappings = ZFeedbackSource.extend({
  formbricksMappings: z.array(ZFeedbackSourceFormbricksMapping),
  fieldMappings: z.array(ZFeedbackSourceFieldMapping),
  creatorName: z.string().nullable().optional(),
});
export type TFeedbackSourceWithMappings = z.infer<typeof ZFeedbackSourceWithMappings>;

// Create input schemas
export const ZFeedbackSourceCreateInput = z.object({
  name: z.string().min(1),
  type: ZFeedbackSourceType,
  feedbackDirectoryId: z.cuid2(),
  createdBy: z.cuid2().optional(),
});
export type TFeedbackSourceCreateInput = z.infer<typeof ZFeedbackSourceCreateInput>;

// Create Formbricks mapping input
export const ZFeedbackSourceFormbricksMappingCreateInput = z.object({
  surveyId: z.cuid2(),
  elementId: z.string(),
  hubFieldType: ZHubFieldType,
  customFieldLabel: z.string().optional(),
});
export type TFeedbackSourceFormbricksMappingCreateInput = z.infer<
  typeof ZFeedbackSourceFormbricksMappingCreateInput
>;

// Create field mapping input
export const ZFeedbackSourceFieldMappingCreateInput = z.object({
  sourceFieldId: z.string(),
  targetFieldId: ZHubTargetField,
  staticValue: z.string().optional(),
});
export type TFeedbackSourceFieldMappingCreateInput = z.infer<typeof ZFeedbackSourceFieldMappingCreateInput>;

// Update feedback source input
export const ZFeedbackSourceUpdateInput = z.object({
  name: z.string().min(1).optional(),
  status: ZFeedbackSourceStatus.optional(),
  lastSyncAt: z.date().nullable().optional(),
});
export type TFeedbackSourceUpdateInput = z.infer<typeof ZFeedbackSourceUpdateInput>;

// Element types that cannot be mapped to Hub fields
export const UNSUPPORTED_FEEDBACK_SOURCE_ELEMENT_TYPES: readonly TSurveyElementTypeEnum[] = [
  TSurveyElementTypeEnum.ContactInfo,
  TSurveyElementTypeEnum.Address,
  TSurveyElementTypeEnum.Cal,
  TSurveyElementTypeEnum.CTA,
  TSurveyElementTypeEnum.FileUpload,
  TSurveyElementTypeEnum.Consent,
] as const;

// Element type to Hub field type mapping helper (only supported types)
export const ELEMENT_TYPE_TO_HUB_FIELD_TYPE: Record<string, THubFieldType> = {
  openText: "text",
  nps: "nps",
  csat: "csat",
  ces: "ces",
  rating: "rating",
  multipleChoiceSingle: "categorical",
  multipleChoiceMulti: "categorical",
  date: "date",
  matrix: "categorical",
  ranking: "categorical",
  pictureSelection: "categorical",
};

// Helper function to get Hub field type from element type
export const getHubFieldTypeFromElementType = (elementType: string): THubFieldType => {
  return ELEMENT_TYPE_TO_HUB_FIELD_TYPE[elementType];
};
