import { z } from "zod";
import { logger } from "@formbricks/logger";
import { ZWorkflowDefinition, ZWorkflowStatus } from "@formbricks/types/workflows";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import {
  problemBadRequest,
  problemInternalError,
  successListResponse,
  successResponse,
} from "@/app/api/v3/lib/response";
import { createWorkflow, listWorkflows } from "@/modules/workflows/lib/service";
import { serializeWorkflow } from "./serializers";

const ZWorkflowListQuery = z.object({
  workspaceId: z.cuid2(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.cuid2().optional(),
  status: ZWorkflowStatus.optional(),
});

const ZCreateWorkflowBody = z.object({
  workspaceId: z.cuid2(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  status: z.literal("draft").optional(),
  definition: ZWorkflowDefinition,
});

const getAuthenticatedUserId = (authentication: unknown): string | undefined => {
  if (authentication && typeof authentication === "object" && "user" in authentication) {
    const user = (authentication as { user?: { id?: string } }).user;
    return user?.id;
  }

  return undefined;
};

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: {
    query: ZWorkflowListQuery,
  },
  handler: async ({ parsedInput, authentication, requestId, instance }) => {
    const log = logger.withContext({ requestId, workspaceId: parsedInput.query.workspaceId });

    try {
      const authResult = await requireV3WorkspaceAccess(
        authentication,
        parsedInput.query.workspaceId,
        "read",
        requestId,
        instance
      );
      if (authResult instanceof Response) {
        return authResult;
      }

      const page = await listWorkflows({
        workspaceId: authResult.workspaceId,
        limit: parsedInput.query.limit,
        cursor: parsedInput.query.cursor,
        status: parsedInput.query.status,
      });

      return successListResponse(page.workflows.map(serializeWorkflow), {
        limit: parsedInput.query.limit ?? 20,
        nextCursor: page.nextCursor,
      });
    } catch (error) {
      log.error({ error, statusCode: 500 }, "V3 workflows list unexpected error");
      return problemInternalError(requestId, "An unexpected error occurred.", instance);
    }
  },
});

export const POST = withV3ApiWrapper({
  auth: "both",
  schemas: {
    body: ZCreateWorkflowBody,
  },
  handler: async ({ parsedInput, authentication, requestId, instance }) => {
    const log = logger.withContext({ requestId, workspaceId: parsedInput.body.workspaceId });

    try {
      const authResult = await requireV3WorkspaceAccess(
        authentication,
        parsedInput.body.workspaceId,
        "readWrite",
        requestId,
        instance
      );
      if (authResult instanceof Response) {
        return authResult;
      }

      const workflow = await createWorkflow({
        workspaceId: authResult.workspaceId,
        name: parsedInput.body.name,
        description: parsedInput.body.description,
        definition: parsedInput.body.definition,
        createdBy: getAuthenticatedUserId(authentication),
      });

      return successResponse(serializeWorkflow(workflow), { requestId, status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return problemBadRequest(requestId, "Invalid workflow definition", { instance });
      }

      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        return problemBadRequest(requestId, "A workflow with this name already exists", { instance });
      }

      log.error({ error, statusCode: 500 }, "V3 workflow create unexpected error");
      return problemInternalError(requestId, "An unexpected error occurred.", instance);
    }
  },
});
