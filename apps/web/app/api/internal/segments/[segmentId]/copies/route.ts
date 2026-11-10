import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { copySegmentOperation } from "../../lib/operations";
import { ZSegmentCopyBody, ZSegmentParams } from "../../schemas";

/**
 * `POST /api/internal/segments/{segmentId}/copies`: copy a segment onto the survey the body names.
 * Licence-gated.
 */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZSegmentParams, body: ZSegmentCopyBody },
  action: "created",
  targetType: "segment",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    copySegmentOperation({
      authentication,
      segmentId: parsedInput.params.segmentId,
      surveyId: parsedInput.body.surveyId,
      requestId,
      instance,
      auditLog,
    }),
});
