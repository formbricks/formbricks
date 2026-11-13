import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { createSegmentOperation } from "./lib/operations";
import { ZSegmentCreateBody } from "./schemas";

/**
 * `POST /api/internal/segments`: create a segment in the workspace the body names, optionally for one
 * survey. Licence-gated (advanced targeting). Listing segments is `GET /api/v3/segments`.
 */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { body: ZSegmentCreateBody },
  action: "created",
  targetType: "segment",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    createSegmentOperation({ authentication, body: parsedInput.body, requestId, instance, auditLog }),
});
