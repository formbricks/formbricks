/**
 * GET /api/v3/feedback-datasets/{datasetId}/dashboard-viewer-access — which records a Dashboard Viewer
 *     sees of the dataset: its conditions and how they combine.
 * PUT /api/v3/feedback-datasets/{datasetId}/dashboard-viewer-access — replace them (at most 10), with an
 *     `expectedUpdatedAt` compare-and-set (409 when stale). Audited on the dataset.
 *
 * Access Control read / write (an Owner or Manager session, or an API key of the dataset's organization);
 * Access Control and Dashboards on the plan. A dataset of another organization, or none, answers 403.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { getV3DatasetViewerAccess, replaceV3DatasetViewerAccess } from "../../lib/operations";
import { ZV3DashboardViewerAccessBody, ZV3FeedbackDatasetParams } from "../../lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { params: ZV3FeedbackDatasetParams, query: ZV3EmptyQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getV3DatasetViewerAccess({
      authentication,
      datasetId: parsedInput.params.datasetId,
      requestId,
      instance,
    }),
});

export const PUT = withV3ApiWrapper({
  auth: "both",
  action: "updated",
  targetType: "feedbackDirectory",
  schemas: { params: ZV3FeedbackDatasetParams, query: ZV3EmptyQuery, body: ZV3DashboardViewerAccessBody },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    replaceV3DatasetViewerAccess({
      authentication,
      datasetId: parsedInput.params.datasetId,
      body: parsedInput.body,
      auditLog,
      requestId,
      instance,
    }),
});
