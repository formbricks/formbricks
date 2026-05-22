import { z } from "zod";
import { logger } from "@formbricks/logger";
import { ZWorkflowRunStatus } from "@formbricks/types/workflows";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { problemForbidden, problemInternalError, successListResponse } from "@/app/api/v3/lib/response";
import { getWorkflow, listWorkflowRuns } from "@/modules/workflows/lib/service";
import { serializeWorkflowRun } from "../../serializers";

const ZWorkflowParams = z.object({
  workflowId: z.cuid2(),
});

const ZWorkflowRunsQuery = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.cuid2().optional(),
  status: ZWorkflowRunStatus.optional(),
});

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: {
    params: ZWorkflowParams,
    query: ZWorkflowRunsQuery,
  },
  handler: async ({ parsedInput, authentication, requestId, instance }) => {
    const workflowId = parsedInput.params.workflowId;
    const log = logger.withContext({ requestId, workflowId });

    try {
      const workflow = await getWorkflow(workflowId);
      if (!workflow) {
        return problemForbidden(requestId, "You are not authorized to access this resource", instance);
      }

      const authResult = await requireV3WorkspaceAccess(
        authentication,
        workflow.workspaceId,
        "read",
        requestId,
        instance
      );
      if (authResult instanceof Response) {
        return authResult;
      }

      const page = await listWorkflowRuns({
        workflowId,
        workspaceId: authResult.workspaceId,
        limit: parsedInput.query.limit,
        cursor: parsedInput.query.cursor,
        status: parsedInput.query.status,
      });

      return successListResponse(page.runs.map(serializeWorkflowRun), {
        limit: parsedInput.query.limit ?? 20,
        nextCursor: page.nextCursor,
      });
    } catch (error) {
      log.error({ error, statusCode: 500 }, "V3 workflow runs list unexpected error");
      return problemInternalError(requestId, "An unexpected error occurred.", instance);
    }
  },
});
