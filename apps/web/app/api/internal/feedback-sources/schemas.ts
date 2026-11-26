import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import {
  ZFeedbackSourceCreateInput,
  ZFeedbackSourceFieldMappingCreateInput,
  ZFeedbackSourceUpdateInput,
} from "@formbricks/types/feedback-source";
import { INTEGRATION_MAPPING_TEXT_MAX_LENGTH } from "@/app/api/internal/integrations/schemas";
import { IDENTIFIER_MAX_LENGTH, PICKED_ITEMS_MAX } from "@/app/api/internal/lib/limits";
import { V3_NAME_MAX_LENGTH } from "@/app/api/v3/charts/lib/schemas";
import { V3_REQUEST_ARRAY_MAX_ITEMS } from "@/app/api/v3/lib/array-budget";

/**
 * Caps on what a source write carries (CODING_STANDARDS.md "Input Limits"), applied here rather than in the
 * shared schemas the Hub sync also uses. A CSV column header is the longest id a field mapping names.
 */
export const FEEDBACK_SOURCE_FIELD_ID_MAX_LENGTH = 1024;

export const ZFeedbackSourceWorkspaceQuery = z.object({ workspaceId: ZId }).strict();

export const ZFeedbackSourceIdParams = z.object({ feedbackSourceId: ZId }).strict();

/** One survey a Formbricks source maps, and which of its questions. */
const ZFormbricksSurveyMapping = z
  .object({
    surveyId: ZId,
    // A survey holds up to `V3_SURVEY_MAX_BLOCKS` blocks, so its mappable questions get the request-wide cap.
    elementIds: z.array(z.string().max(IDENTIFIER_MAX_LENGTH)).min(1).max(V3_REQUEST_ARRAY_MAX_ITEMS),
  })
  .strict();

/** One CSV column a source maps onto a Hub field. The shared schema strips unknown keys; this refuses them. */
const ZFieldMapping = ZFeedbackSourceFieldMappingCreateInput.extend({
  sourceFieldId: ZFeedbackSourceFieldMappingCreateInput.shape.sourceFieldId.max(
    FEEDBACK_SOURCE_FIELD_ID_MAX_LENGTH
  ),
  staticValue: ZFeedbackSourceFieldMappingCreateInput.shape.staticValue
    .unwrap()
    .max(INTEGRATION_MAPPING_TEXT_MAX_LENGTH)
    .optional(),
}).strict();

const ZSurveyMappings = z.array(ZFormbricksSurveyMapping).max(PICKED_ITEMS_MAX);
const ZFieldMappings = z.array(ZFieldMapping).max(PICKED_ITEMS_MAX);

/**
 * A new source and its mappings. A Formbricks source maps surveys, a CSV source maps fields. Who created
 * it comes from the session, never the body.
 */
export const ZFeedbackSourceCreateBody = z
  .object({
    source: ZFeedbackSourceCreateInput.omit({ createdBy: true })
      .extend({ name: ZFeedbackSourceCreateInput.shape.name.max(V3_NAME_MAX_LENGTH) })
      .strict(),
    formbricksMappings: ZSurveyMappings.optional(),
    fieldMappings: ZFieldMappings.optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    if (body.source.type === "formbricks_survey" && !body.formbricksMappings?.length) {
      ctx.addIssue({
        code: "custom",
        path: ["formbricksMappings"],
        message: "At least one survey mapping is required for Formbricks sources",
      });
    } else if (body.source.type === "csv" && !body.fieldMappings?.length) {
      ctx.addIssue({
        code: "custom",
        path: ["fieldMappings"],
        message: "At least one field mapping is required for CSV sources",
      });
    }
  });

/**
 * A change to a source: its name, status or import mode, and optionally its mappings. `lastSyncAt` is the
 * sync's to write, not a client's.
 */
export const ZFeedbackSourceUpdateBody = z
  .object({
    source: ZFeedbackSourceUpdateInput.omit({ lastSyncAt: true })
      .extend({ name: ZFeedbackSourceUpdateInput.shape.name.unwrap().max(V3_NAME_MAX_LENGTH).optional() })
      .strict()
      .optional(),
    formbricksMappings: ZSurveyMappings.min(1).optional(),
    fieldMappings: ZFieldMappings.optional(),
  })
  .strict();

/** Replay one mapped survey's past responses into the source. */
export const ZFeedbackSourceImportBody = z.object({ surveyId: ZId }).strict();

export type TFeedbackSourceCreateBody = z.infer<typeof ZFeedbackSourceCreateBody>;
export type TFeedbackSourceUpdateBody = z.infer<typeof ZFeedbackSourceUpdateBody>;
export type TFeedbackSourceImportBody = z.infer<typeof ZFeedbackSourceImportBody>;

/** What a write answers with: the source's id. The page re-renders its list from the server. */
export type TFeedbackSourceWriteResource = { id: string };

/** What an import answers with: how many responses it replayed, failed and skipped. */
export type TFeedbackSourceImportResource = { successes: number; failures: number; skipped: number };
