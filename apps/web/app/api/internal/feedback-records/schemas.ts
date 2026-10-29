import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZFeedbackRecordId } from "@/modules/ee/unify-feedback/types";

export const ZFeedbackRecordParams = z.object({ recordId: ZFeedbackRecordId }).strict();

/** A record is reached through a workspace: one its dataset is assigned to. */
export const ZFeedbackRecordWorkspaceQuery = z.object({ workspaceId: ZId }).strict();

/** Up to 1000 records' `user_id`s to resolve to this workspace's contacts. */
export const ZFeedbackRecordContactLookupBody = z.object({ userIds: z.array(z.string()).max(1000) }).strict();
