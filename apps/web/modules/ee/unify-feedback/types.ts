import { z } from "zod";
import { ZId } from "@formbricks/types/common";

export const ZFeedbackRecordId = z.uuid();

export const ZRetrieveFeedbackRecordAction = z.object({
  workspaceId: ZId,
  recordId: ZFeedbackRecordId,
});

export type TRetrieveFeedbackRecordAction = z.infer<typeof ZRetrieveFeedbackRecordAction>;

export const ZDeleteFeedbackRecordAction = z.object({
  workspaceId: ZId,
  recordId: ZFeedbackRecordId,
});

export type TDeleteFeedbackRecordAction = z.infer<typeof ZDeleteFeedbackRecordAction>;
