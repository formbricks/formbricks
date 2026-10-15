import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { lookupFeedbackRecordContactsOperation } from "../lib/operations";
import { ZFeedbackRecordContactLookupBody, ZFeedbackRecordWorkspaceQuery } from "../schemas";

/**
 * `POST /api/internal/feedback-records/contact-lookups?workspaceId=`: resolve records' `user_id`s to
 * contact ids. A read sent as POST: a page of ids does not fit a URL.
 */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZFeedbackRecordWorkspaceQuery, body: ZFeedbackRecordContactLookupBody },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    lookupFeedbackRecordContactsOperation({
      authentication,
      workspaceId: parsedInput.query.workspaceId,
      userIds: parsedInput.body.userIds,
      requestId,
      instance,
    }),
});
