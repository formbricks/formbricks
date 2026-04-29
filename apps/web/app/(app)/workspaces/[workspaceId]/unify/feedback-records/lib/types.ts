import { z } from "zod";

export const FIELD_TYPE_OPTIONS = [
  "text",
  "categorical",
  "nps",
  "csat",
  "ces",
  "rating",
  "number",
  "boolean",
  "date",
] as const;

export const SOURCE_TYPE_PRESET_OPTIONS = [
  "survey",
  "review",
  "feedback_form",
  "support",
  "social",
  "interview",
  "usability_test",
  "nps_campaign",
] as const;

export const SOURCE_TYPE_CUSTOM_VALUE = "__custom__";

const ZMetadataEntry = z.object({
  key: z.string().trim().min(1),
  value: z.string(),
});

export const ZFeedbackRecordFormValues = z.object({
  id: z.string().optional(),
  tenant_id: z.string().min(1),
  submission_id: z.string().min(1),
  collected_at: z.string().min(1),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  source_type: z.string().min(1),
  source_id: z.string().optional(),
  source_name: z.string().optional(),
  field_id: z.string().min(1),
  field_label: z.string().optional(),
  field_type: z.enum(FIELD_TYPE_OPTIONS),
  field_group_id: z.string().optional(),
  field_group_label: z.string().optional(),
  value_text: z.string().optional(),
  value_number: z.string().optional(),
  value_boolean: z.boolean().optional(),
  value_date: z.string().optional(),
  language: z.string().optional(),
  user_identifier: z.string().optional(),
  metadataEntries: z.array(ZMetadataEntry),
});

export type TFeedbackRecordFormValues = z.infer<typeof ZFeedbackRecordFormValues>;
