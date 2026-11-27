import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { deleteSegmentOperation, updateSegmentOperation } from "../lib/operations";
import { ZSegmentParams, ZSegmentUpdateBody, ZSegmentWorkspaceQuery } from "../schemas";

/** `PATCH /api/internal/segments/{segmentId}?workspaceId=`: change a segment, or connect surveys to it. Licence-gated. */
export const PATCH = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZSegmentParams, query: ZSegmentWorkspaceQuery, body: ZSegmentUpdateBody },
  action: "updated",
  targetType: "segment",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    updateSegmentOperation({
      authentication,
      segmentId: parsedInput.params.segmentId,
      workspaceId: parsedInput.query.workspaceId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});

/** `DELETE /api/internal/segments/{segmentId}?workspaceId=`: delete a segment no survey uses. Licence-gated. */
export const DELETE = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZSegmentParams, query: ZSegmentWorkspaceQuery },
  action: "deleted",
  targetType: "segment",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    deleteSegmentOperation({
      authentication,
      segmentId: parsedInput.params.segmentId,
      workspaceId: parsedInput.query.workspaceId,
      requestId,
      instance,
      auditLog,
    }),
});
