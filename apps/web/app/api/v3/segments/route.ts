/**
 * /api/v3/segments
 *   GET  — list a workspace's reusable segments.
 *   POST — create one.
 *
 * Session cookie, API key or OAuth token, behind the Enterprise contacts entitlement. A survey's own
 * (private) targeting is not a segment here; it is the survey's `targeting`.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { createV3Segment, listV3Segments } from "./lib/operations";
import { ZV3CreateSegmentBody, ZV3SegmentListQuery } from "./lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { query: ZV3SegmentListQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    listV3Segments({ query: parsedInput.query, authentication, requestId, instance }),
});

export const POST = withV3ApiWrapper({
  auth: "both",
  action: "created",
  targetType: "segment",
  schemas: { body: ZV3CreateSegmentBody },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    createV3Segment({ body: parsedInput.body, authentication, auditLog, requestId, instance }),
});
