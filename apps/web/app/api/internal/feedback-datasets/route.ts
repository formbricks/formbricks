/**
 * POST /api/internal/feedback-datasets?organizationId= — create a feedback dataset (a feedback
 * directory). Owners and managers of the organization, on the Enterprise plan. Session-only.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { createFeedbackDatasetOperation } from "./lib/operations";
import { ZDatasetCreateBody, ZDatasetCreateQuery } from "./lib/schemas";

export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZDatasetCreateQuery, body: ZDatasetCreateBody },
  action: "created",
  targetType: "feedbackDirectory",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    createFeedbackDatasetOperation({
      authentication,
      organizationId: parsedInput.query.organizationId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});
