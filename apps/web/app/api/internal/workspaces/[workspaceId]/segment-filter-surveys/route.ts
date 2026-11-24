import { listSegmentFilterSurveysOperation } from "@/app/api/internal/segments/lib/operations";
import { ZWorkspaceSegmentFilterSurveysParams } from "@/app/api/internal/segments/schemas";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";

/**
 * `GET /api/internal/workspaces/{workspaceId}/segment-filter-surveys`: the surveys a segment's
 * survey-interaction filter can name. Licence-gated (advanced targeting).
 */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZWorkspaceSegmentFilterSurveysParams },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    listSegmentFilterSurveysOperation({
      authentication,
      workspaceId: parsedInput.params.workspaceId,
      requestId,
      instance,
    }),
});
