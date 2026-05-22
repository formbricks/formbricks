import { z } from "zod";
import { logger } from "@formbricks/logger";
import { ZWorkflowDefinition } from "@formbricks/types/workflows";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import {
  problemBadRequest,
  problemForbidden,
  problemInternalError,
  successResponse,
} from "@/app/api/v3/lib/response";
import {
  deleteWorkflow,
  getWorkflow,
  getWorkflowByWorkspace,
  updateWorkflow,
} from "@/modules/workflows/lib/service";
import { serializeWorkflow } from "../serializers";

const ZWorkflowParams = z.object({
  workflowId: z.cuid2(),
});

const ZUpdateWorkflowBody = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  definition: ZWorkflowDefinition.optional(),
});

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: {
    params: ZWorkflowParams,
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

      return successResponse(serializeWorkflow(workflow), { requestId });
    } catch (error) {
      log.error({ error, statusCode: 500 }, "V3 workflow detail unexpected error");
      return problemInternalError(requestId, "An unexpected error occurred.", instance);
    }
  },
});

export const PATCH = withV3ApiWrapper({
  auth: "both",
  schemas: {
    params: ZWorkflowParams,
    body: ZUpdateWorkflowBody,
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

      const workflow = await updateWorkflow({
        workflowId,
        workspaceId: authResult.workspaceId,
        name: parsedInput.body.name,
        description: parsedInput.body.description,
        definition: parsedInput.body.definition,
      });

      if (!workflow) {
        return problemForbidden(requestId, "You are not authorized to access this resource", instance);
      }

      return successResponse(serializeWorkflow(workflow), { requestId });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        return problemBadRequest(requestId, "A workflow with this name already exists", { instance });
      }

      if (error instanceof z.ZodError || error instanceof Error) {
        return problemBadRequest(requestId, error.message, { instance });
      }

      log.error({ error, statusCode: 500 }, "V3 workflow update unexpected error");
      return problemInternalError(requestId, "An unexpected error occurred.", instance);
    }
  },
});

export const DELETE = withV3ApiWrapper({
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

      const workflow = await getWorkflowByWorkspace(workflowId, authResult.workspaceId);
      if (!workflow) {
        return problemForbidden(requestId, "You are not authorized to access this resource", instance);
      }

      const deletedWorkflow = await deleteWorkflow(workflowId, authResult.workspaceId);
      return successResponse(deletedWorkflow, { requestId });
    } catch (error) {
      log.error({ error, statusCode: 500 }, "V3 workflow delete unexpected error");
      return problemInternalError(requestId, "An unexpected error occurred.", instance);
    }
  },
});
