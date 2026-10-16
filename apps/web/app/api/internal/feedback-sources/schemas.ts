import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import {
  ZFeedbackSourceCreateInput,
  ZFeedbackSourceFieldMappingCreateInput,
  ZFeedbackSourceUpdateInput,
} from "@formbricks/types/feedback-source";

export const ZFeedbackSourceWorkspaceQuery = z.object({ workspaceId: ZId }).strict();

export const ZFeedbackSourceIdParams = z.object({ feedbackSourceId: ZId }).strict();

/** One survey a Formbricks source maps, and which of its questions. */
const ZFormbricksSurveyMapping = z.object({
  surveyId: ZId,
  elementIds: z.array(z.string()).min(1),
});

/**
 * A new source and its mappings. A Formbricks source maps surveys, a CSV source maps fields. Who created
 * it comes from the session, never the body.
 */
export const ZFeedbackSourceCreateBody = z
  .object({
    source: ZFeedbackSourceCreateInput.omit({ createdBy: true }).strict(),
    formbricksMappings: z.array(ZFormbricksSurveyMapping).optional(),
    fieldMappings: z.array(ZFeedbackSourceFieldMappingCreateInput).optional(),
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
    source: ZFeedbackSourceUpdateInput.omit({ lastSyncAt: true }).strict().optional(),
    formbricksMappings: z.array(ZFormbricksSurveyMapping).min(1).optional(),
    fieldMappings: z.array(ZFeedbackSourceFieldMappingCreateInput).optional(),
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
