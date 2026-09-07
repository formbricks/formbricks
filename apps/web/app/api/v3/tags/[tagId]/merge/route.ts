/**
 * POST /api/v3/tags/{tagId}/merge — move every response tagged `{tagId}` onto `newTagId`, then drop
 * `{tagId}`. Both tags must belong to the same workspace; the operation rejects a cross-workspace merge.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { mergeV3Tags } from "../../lib/operations";
import { ZV3MergeTagBody, ZV3TagIdParams } from "../../lib/schemas";

export const POST = withV3ApiWrapper({
  auth: "session",
  action: "merged",
  targetType: "tag",
  schemas: { params: ZV3TagIdParams, body: ZV3MergeTagBody },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    mergeV3Tags({
      authentication,
      tagId: parsedInput.params.tagId,
      newTagId: parsedInput.body.newTagId,
      auditLog,
      requestId,
      instance,
    }),
});
