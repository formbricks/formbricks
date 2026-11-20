import "server-only";
import { prisma } from "@formbricks/database";
import type { TWorkflowIdInput } from "@formbricks/workflows";
import { loadAndAuthorize, toProblemResponse } from "@formbricks/workflows/server";
import { successResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { buildWorkflowApiContext, workflowsService } from "@/app/api/v3/workflows/lib/context";
import { maskStoredDefinition } from "./mask-stored-definition";

export type TPublishedWorkflowVersion = {
  version: number;
  publishedAt: string;
  definition: unknown;
};

/**
 * `GET /api/internal/workflows/{workflowId}/published-version`: the definition the workflow last ran
 * with, i.e. its latest enabled version, or `null` when it has never been enabled. The editor's
 * "Discard changes" loads it back into the draft, which then saves like any other edit (and can be
 * undone). Write access, like editing: only someone who can change the draft can discard it.
 */
export const getPublishedWorkflowVersion = async ({
  authentication,
  requestId,
  instance,
  params,
}: {
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
  params: TWorkflowIdInput;
}): Promise<Response> => {
  const ctx = buildWorkflowApiContext(authentication, requestId, instance);
  try {
    const workflow = await loadAndAuthorize(workflowsService, ctx, params.workflowId, "readWrite");
    if (workflow instanceof Response) return workflow;

    const latest = await prisma.workflowVersion.findFirst({
      where: { workflowId: workflow.id, workspaceId: workflow.workspaceId },
      orderBy: { version: "desc" },
      select: { version: true, publishedAt: true, definition: true },
    });
    const data: TPublishedWorkflowVersion | null = latest
      ? {
          version: latest.version,
          publishedAt: latest.publishedAt.toISOString(),
          definition: maskStoredDefinition(latest.definition),
        }
      : null;
    return successResponse(data, { requestId });
  } catch (error) {
    return toProblemResponse(error, ctx);
  }
};
