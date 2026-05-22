import { z } from "zod";
import { logger } from "@formbricks/logger";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import {
  problemBadRequest,
  problemForbidden,
  problemInternalError,
  successResponse,
} from "@/app/api/v3/lib/response";
import { enableWorkflow, getWorkflow } from "@/modules/workflows/lib/service";
import { serializeWorkflow } from "../../serializers";

const ZWorkflowParams = z.object({
  workflowId: z.cuid2(),
});

export const POST = withV3ApiWrapper({
  auth: "both",
  schemas: {
    params: ZWorkflowParams,
  },
  handler: async ({ parsedInput, authentication, requestId, instance }) => {
    const workflowId = parsedInput.params.workflowId;
    const log = logger.withContext({ requestId, workflowId });

    try {
      const existingWorkflow = await getWorkflow(workflowId);
      if (!existingWorkflow) {
        return problemForbidden(requestId, "You are not authorized to access this resource", instance);
      }

      const authResult = await requireV3WorkspaceAccess(
        authentication,
        existingWorkflow.workspaceId,
        "readWrite",
        requestId,
        instance
      );
      if (authResult instanceof Response) {
        return authResult;
      }

      const workflow = await enableWorkflow(workflowId, authResult.workspaceId);
      if (!workflow) {
        return problemForbidden(requestId, "You are not authorized to access this resource", instance);
      }

      return successResponse(serializeWorkflow(workflow), { requestId });
    } catch (error) {
      if (error instanceof z.ZodError || error instanceof Error) {
        return problemBadRequest(requestId, error.message, { instance });
      }

      log.error({ error, statusCode: 500 }, "V3 workflow enable unexpected error");
      return problemInternalError(requestId, "An unexpected error occurred.", instance);
    }
  },
});
