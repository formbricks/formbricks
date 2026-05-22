import { z } from "zod";
import { logger } from "@formbricks/logger";
import { ZWorkflowRunStatus } from "@formbricks/types/workflows";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { problemInternalError, successListResponse } from "@/app/api/v3/lib/response";
import { listWorkspaceWorkflowRuns } from "@/modules/workflows/lib/service";
import { serializeWorkflowRunWithWorkflow } from "../serializers";

const ZWorkspaceWorkflowRunsQuery = z.object({
  workspaceId: z.cuid2(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.cuid2().optional(),
  status: ZWorkflowRunStatus.optional(),
});

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: {
    query: ZWorkspaceWorkflowRunsQuery,
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

      const page = await listWorkspaceWorkflowRuns({
        workspaceId: authResult.workspaceId,
        limit: parsedInput.query.limit,
        cursor: parsedInput.query.cursor,
        status: parsedInput.query.status,
      });

      return successListResponse(page.runs.map(serializeWorkflowRunWithWorkflow), {
        limit: parsedInput.query.limit ?? 20,
        nextCursor: page.nextCursor,
      });
    } catch (error) {
      log.error({ error, statusCode: 500 }, "V3 workspace workflow runs list unexpected error");
      return problemInternalError(requestId, "An unexpected error occurred.", instance);
    }
  },
});
