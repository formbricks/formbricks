import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZFeedbackRecordId } from "@/modules/ee/unify-feedback/types";

const ZFeedbackRecordFieldType = z.enum([
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

/** One page of one dataset's records, as the workspace's feedback records table reads them. */
export const ZFeedbackRecordListQuery = z
  .object({
    workspaceId: ZId,
    datasetId: ZId,
    limit: z.coerce.number().int().min(1).max(1000).optional(),
    cursor: z.string().optional(),
    sourceType: z.string().optional(),
    fieldType: ZFeedbackRecordFieldType.optional(),
    since: z.string().optional(),
    until: z.string().optional(),
  })
  .strict();

export const ZFeedbackRecordParams = z.object({ recordId: ZFeedbackRecordId }).strict();

/** A record is reached through a workspace: one its dataset is assigned to. */
export const ZFeedbackRecordWorkspaceQuery = z.object({ workspaceId: ZId }).strict();

/** Up to 1000 records' `user_id`s to resolve to this workspace's contacts. */
export const ZFeedbackRecordContactLookupBody = z.object({ userIds: z.array(z.string()).max(1000) }).strict();

export type TFeedbackRecordListQuery = z.infer<typeof ZFeedbackRecordListQuery>;
