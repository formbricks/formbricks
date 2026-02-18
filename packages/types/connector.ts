import { z } from "zod";

// Connector type enum
export const ZConnectorType = z.enum(["formbricks", "webhook", "csv", "email", "slack"]);
export type TConnectorType = z.infer<typeof ZConnectorType>;

// Connector status enum
export const ZConnectorStatus = z.enum(["active", "paused", "error"]);
export type TConnectorStatus = z.infer<typeof ZConnectorStatus>;

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

// Hub target fields for mapping
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
  "user_identifier",
]);
export type THubTargetField = z.infer<typeof ZHubTargetField>;

// Base connector schema
export const ZConnector = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string().min(1),
  type: ZConnectorType,
  status: ZConnectorStatus,
  environmentId: z.string().cuid2(),
  config: z.record(z.unknown()).nullable(),
  lastSyncAt: z.date().nullable(),
  errorMessage: z.string().nullable(),
});
export type TConnector = z.infer<typeof ZConnector>;

// Formbricks element mapping
export const ZConnectorFormbricksMapping = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  connectorId: z.string().cuid2(),
  surveyId: z.string().cuid2(),
  elementId: z.string(),
  hubFieldType: ZHubFieldType,
  customFieldLabel: z.string().nullable(),
});
export type TConnectorFormbricksMapping = z.infer<typeof ZConnectorFormbricksMapping>;

// Generic field mapping (for webhook, csv, email, slack)
export const ZConnectorFieldMapping = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  connectorId: z.string().cuid2(),
  sourceFieldId: z.string(),
  targetFieldId: ZHubTargetField,
  staticValue: z.string().nullable(),
});
export type TConnectorFieldMapping = z.infer<typeof ZConnectorFieldMapping>;

// Formbricks connector with mappings
export const ZFormbricksConnector = ZConnector.extend({
  type: z.literal("formbricks"),
  formbricksMappings: z.array(ZConnectorFormbricksMapping),
});
export type TFormbricksConnector = z.infer<typeof ZFormbricksConnector>;

// Webhook connector config
export const ZWebhookConnectorConfig = z.object({
  webhookSecret: z.string().optional(),
  payloadSchema: z.record(z.unknown()).optional(),
});
export type TWebhookConnectorConfig = z.infer<typeof ZWebhookConnectorConfig>;

// Webhook connector with config and mappings
export const ZWebhookConnector = ZConnector.extend({
  type: z.literal("webhook"),
  config: ZWebhookConnectorConfig.nullable(),
  fieldMappings: z.array(ZConnectorFieldMapping),
});
export type TWebhookConnector = z.infer<typeof ZWebhookConnector>;

// CSV connector config
export const ZCSVConnectorConfig = z.object({
  importMode: z.enum(["manual", "s3"]),
  s3Config: z
    .object({
      bucketName: z.string(),
      region: z.string(),
      prefix: z.string().optional(),
    })
    .optional(),
});
export type TCSVConnectorConfig = z.infer<typeof ZCSVConnectorConfig>;

// CSV connector with config and mappings
export const ZCSVConnector = ZConnector.extend({
  type: z.literal("csv"),
  config: ZCSVConnectorConfig.nullable(),
  fieldMappings: z.array(ZConnectorFieldMapping),
});
export type TCSVConnector = z.infer<typeof ZCSVConnector>;

// Email connector config
export const ZEmailConnectorConfig = z.object({
  parseMode: z.string().optional(),
});
export type TEmailConnectorConfig = z.infer<typeof ZEmailConnectorConfig>;

// Email connector with config and mappings
export const ZEmailConnector = ZConnector.extend({
  type: z.literal("email"),
  config: ZEmailConnectorConfig.nullable(),
  fieldMappings: z.array(ZConnectorFieldMapping),
});
export type TEmailConnector = z.infer<typeof ZEmailConnector>;

// Slack connector config
export const ZSlackConnectorConfig = z.object({
  channelId: z.string().optional(),
});
export type TSlackConnectorConfig = z.infer<typeof ZSlackConnectorConfig>;

// Slack connector with config and mappings
export const ZSlackConnector = ZConnector.extend({
  type: z.literal("slack"),
  config: ZSlackConnectorConfig.nullable(),
  fieldMappings: z.array(ZConnectorFieldMapping),
});
export type TSlackConnector = z.infer<typeof ZSlackConnector>;

// Union type for any connector with its mappings
export type TConnectorWithMappings =
  | TFormbricksConnector
  | TWebhookConnector
  | TCSVConnector
  | TEmailConnector
  | TSlackConnector;

// UI helper types - Formbricks mapping with joined survey/element data
export const ZConnectorFormbricksMappingWithDetails = ZConnectorFormbricksMapping.extend({
  survey: z.object({
    id: z.string(),
    name: z.string(),
    status: z.string(),
  }),
  element: z.object({
    id: z.string(),
    headline: z.string(),
    type: z.string(),
  }),
});
export type TConnectorFormbricksMappingWithDetails = z.infer<typeof ZConnectorFormbricksMappingWithDetails>;

// Create input schemas
export const ZConnectorCreateInput = z.object({
  name: z.string().min(1),
  type: ZConnectorType,
  config: z.record(z.unknown()).optional(),
});
export type TConnectorCreateInput = z.infer<typeof ZConnectorCreateInput>;

// Create Formbricks mapping input
export const ZConnectorFormbricksMappingCreateInput = z.object({
  surveyId: z.string().cuid2(),
  elementId: z.string(),
  hubFieldType: ZHubFieldType,
  customFieldLabel: z.string().optional(),
});
export type TConnectorFormbricksMappingCreateInput = z.infer<typeof ZConnectorFormbricksMappingCreateInput>;

// Create field mapping input
export const ZConnectorFieldMappingCreateInput = z.object({
  sourceFieldId: z.string(),
  targetFieldId: ZHubTargetField,
  staticValue: z.string().optional(),
});
export type TConnectorFieldMappingCreateInput = z.infer<typeof ZConnectorFieldMappingCreateInput>;

// Update connector input
export const ZConnectorUpdateInput = z.object({
  name: z.string().min(1).optional(),
  status: ZConnectorStatus.optional(),
  config: z.record(z.unknown()).optional(),
  errorMessage: z.string().nullable().optional(),
  lastSyncAt: z.date().nullable().optional(),
});
export type TConnectorUpdateInput = z.infer<typeof ZConnectorUpdateInput>;

// Element type to Hub field type mapping helper
export const ELEMENT_TYPE_TO_HUB_FIELD_TYPE: Record<string, THubFieldType> = {
  openText: "text",
  nps: "nps",
  rating: "rating",
  multipleChoiceSingle: "categorical",
  multipleChoiceMulti: "categorical",
  date: "date",
  consent: "boolean",
  matrix: "categorical",
  ranking: "categorical",
  pictureSelection: "categorical",
  contactInfo: "text",
  address: "text",
  fileUpload: "text",
  cal: "text",
  cta: "boolean",
};

// Helper function to get Hub field type from element type
export const getHubFieldTypeFromElementType = (elementType: string): THubFieldType => {
  return ELEMENT_TYPE_TO_HUB_FIELD_TYPE[elementType];
};
