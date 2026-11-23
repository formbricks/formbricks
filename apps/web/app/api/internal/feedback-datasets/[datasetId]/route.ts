/**
 * GET/PATCH /api/internal/feedback-datasets/{datasetId} — a feedback dataset's settings: its name, its
 * workspaces and whether it is archived. Owners and managers of the owning organization. Session-only.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { getFeedbackDatasetOperation, updateFeedbackDatasetOperation } from "../lib/operations";
import { ZDatasetPathParams, ZDatasetUpdateBody } from "../lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZDatasetPathParams, query: ZV3EmptyQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getFeedbackDatasetOperation({
      authentication,
      datasetId: parsedInput.params.datasetId,
      requestId,
      instance,
    }),
});

export const PATCH = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZDatasetPathParams, query: ZV3EmptyQuery, body: ZDatasetUpdateBody },
  action: "updated",
  targetType: "feedbackDirectory",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    updateFeedbackDatasetOperation({
      authentication,
      datasetId: parsedInput.params.datasetId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});
