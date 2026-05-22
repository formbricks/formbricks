import { z } from "zod";
import { logger } from "@formbricks/logger";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { problemForbidden, problemInternalError, successResponse } from "@/app/api/v3/lib/response";
import { getWorkflow, getWorkflowRun } from "@/modules/workflows/lib/service";
import { serializeWorkflowRun } from "../../../serializers";

const ZWorkflowRunParams = z.object({
  workflowId: z.cuid2(),
  runId: z.cuid2(),
});

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: {
    params: ZWorkflowRunParams,
  },
  handler: async ({ parsedInput, authentication, requestId, instance }) => {
    const { workflowId, runId } = parsedInput.params;
    const log = logger.withContext({ requestId, workflowId, runId });

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

      const run = await getWorkflowRun(workflowId, authResult.workspaceId, runId);
      if (!run) {
        return problemForbidden(requestId, "You are not authorized to access this resource", instance);
      }

      return successResponse(serializeWorkflowRun(run), { requestId });
    } catch (error) {
      log.error({ error, statusCode: 500 }, "V3 workflow run detail unexpected error");
      return problemInternalError(requestId, "An unexpected error occurred.", instance);
    }
  },
});
