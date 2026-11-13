import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { IDENTIFIER_MAX_LENGTH } from "@/app/api/internal/lib/limits";
import { ZFeedbackRecordId } from "@/modules/ee/unify-feedback/types";

export const ZFeedbackRecordParams = z.object({ recordId: ZFeedbackRecordId }).strict();

/** A record is reached through a workspace: one its dataset is assigned to. */
export const ZFeedbackRecordWorkspaceQuery = z.object({ workspaceId: ZId }).strict();

/** Records' `user_id`s resolved in one lookup: a page of records holds at most this many. */
export const CONTACT_LOOKUP_USER_IDS_MAX = 1000;

/**
 * Up to 1000 records' `user_id`s to resolve to this workspace's contacts. The Hub stores a `user_id` of at
 * most 255 characters, so a longer one can't come from a record.
 */
export const ZFeedbackRecordContactLookupBody = z
  .object({ userIds: z.array(z.string().max(IDENTIFIER_MAX_LENGTH)).max(CONTACT_LOOKUP_USER_IDS_MAX) })
  .strict();
