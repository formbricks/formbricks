/**
 * /api/v3/segments/{segmentId}
 *   GET    — one segment with its filter tree and the surveys using it.
 *   PATCH  — change its title, description or filters.
 *   DELETE — delete it; refused while a survey uses it.
 *
 * The workspace is resolved from the segment, never from the request.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { deleteV3Segment, getV3Segment, updateV3Segment } from "../lib/operations";
import { ZV3PatchSegmentBody, ZV3SegmentIdParams } from "../lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { params: ZV3SegmentIdParams, query: ZV3EmptyQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getV3Segment({ segmentId: parsedInput.params.segmentId, authentication, requestId, instance }),
});

export const PATCH = withV3ApiWrapper({
  auth: "both",
  action: "updated",
  targetType: "segment",
  schemas: { params: ZV3SegmentIdParams, body: ZV3PatchSegmentBody },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    updateV3Segment({
      segmentId: parsedInput.params.segmentId,
      body: parsedInput.body,
      authentication,
      auditLog,
      requestId,
      instance,
    }),
});

export const DELETE = withV3ApiWrapper({
  auth: "both",
  action: "deleted",
  targetType: "segment",
  schemas: { params: ZV3SegmentIdParams, query: ZV3EmptyQuery },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    deleteV3Segment({
      segmentId: parsedInput.params.segmentId,
      authentication,
      auditLog,
      requestId,
      instance,
    }),
});
