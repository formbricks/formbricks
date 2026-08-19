/**
 * PATCH  /api/v3/tags/{tagId} — rename a tag.
 * DELETE /api/v3/tags/{tagId} — delete a tag and its response links.
 *
 * The workspace is resolved from the tag, never from the request, so the caller cannot supply the scope
 * it is authorized against. Session-only, matching the actions these replace.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { deleteV3Tag, renameV3Tag } from "../lib/operations";
import { ZV3RenameTagBody, ZV3TagIdParams } from "../lib/schemas";

export const PATCH = withV3ApiWrapper({
  auth: "session",
  action: "updated",
  targetType: "tag",
  schemas: { params: ZV3TagIdParams, body: ZV3RenameTagBody },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    renameV3Tag({
      authentication,
      tagId: parsedInput.params.tagId,
      name: parsedInput.body.name,
      auditLog,
      requestId,
      instance,
    }),
});

export const DELETE = withV3ApiWrapper({
  auth: "session",
  action: "deleted",
  targetType: "tag",
  schemas: { params: ZV3TagIdParams },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    deleteV3Tag({
      authentication,
      tagId: parsedInput.params.tagId,
      auditLog,
      requestId,
      instance,
    }),
});
