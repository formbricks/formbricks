import { z } from "zod";
import { ZId } from "@formbricks/types/common";

export const ZFeedbackRecordId = z.uuid();

export const ZFeedbackRecordFieldType = z.enum([
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

export const ZFeedbackRecordMetadata = z.record(z.string(), z.unknown());

export const ZFeedbackRecordCreateInput = z.object({
  submission_id: z.string().min(1),
  tenant_id: ZId,
  source_type: z.string().min(1),
  field_id: z.string().min(1),
  field_type: ZFeedbackRecordFieldType,
  collected_at: z.iso.datetime().optional(),
  source_id: z.string().optional().nullable(),
  source_name: z.string().optional().nullable(),
  field_label: z.string().optional().nullable(),
  field_group_id: z.string().optional(),
  field_group_label: z.string().optional().nullable(),
  value_text: z.string().optional().nullable(),
  value_number: z.number().optional(),
  value_boolean: z.boolean().optional(),
  value_date: z.iso.datetime().optional(),
  metadata: ZFeedbackRecordMetadata.optional(),
  language: z.string().optional(),
  user_id: z.string().optional(),
});

export type TFeedbackRecordCreateInput = z.infer<typeof ZFeedbackRecordCreateInput>;

export const ZFeedbackRecordUpdateInput = z
  .object({
    value_text: z.string().optional().nullable(),
    value_number: z.number().optional().nullable(),
    value_boolean: z.boolean().optional().nullable(),
    value_date: z.iso.datetime().optional().nullable(),
    language: z.string().optional().nullable(),
    metadata: ZFeedbackRecordMetadata.optional(),
    user_id: z.string().optional().nullable(),
  })
  .refine(
    (value) => Object.values(value).some((entry) => entry !== undefined),
    "At least one field must be provided for update"
  );

export type TFeedbackRecordUpdateInput = z.infer<typeof ZFeedbackRecordUpdateInput>;

// The manual-record CRUD actions are now org-scoped: the dataset (feedback directory) is the unit
// of access, resolved via its owning organization. `directoryId` is authorized with the org-context
// guards (assertCanViewDirectory / assertCanWriteDirectoryRecords) instead of the old workspace check.
export const ZRetrieveFeedbackRecordAction = z.object({
  organizationId: ZId,
  directoryId: ZId,
  recordId: ZFeedbackRecordId,
});

export type TRetrieveFeedbackRecordAction = z.infer<typeof ZRetrieveFeedbackRecordAction>;

export const ZCreateFeedbackRecordAction = z.object({
  organizationId: ZId,
  directoryId: ZId,
  recordInput: ZFeedbackRecordCreateInput,
});

export type TCreateFeedbackRecordAction = z.infer<typeof ZCreateFeedbackRecordAction>;

export const ZUpdateFeedbackRecordAction = z.object({
  organizationId: ZId,
  directoryId: ZId,
  recordId: ZFeedbackRecordId,
  updateInput: ZFeedbackRecordUpdateInput,
});

export type TUpdateFeedbackRecordAction = z.infer<typeof ZUpdateFeedbackRecordAction>;

export const ZDeleteFeedbackRecordAction = z.object({
  organizationId: ZId,
  directoryId: ZId,
  recordId: ZFeedbackRecordId,
});

export type TDeleteFeedbackRecordAction = z.infer<typeof ZDeleteFeedbackRecordAction>;
