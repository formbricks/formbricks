import "server-only";
import { prisma } from "@formbricks/database";
import type { TWorkflowIdInput, TWorkflowSampleList } from "@formbricks/workflows";
import { WorkflowForbiddenError, toProblemResponse } from "@formbricks/workflows/server";
import { successResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { buildWorkflowApiContext } from "./context";

/**
 * `GET /api/v3/workflows/{workflowId}/samples`: the samples a workflow keeps (ADR 0048), one per
 * source — the Webhook trigger's Sample payload and each HTTP request step's last Test request
 * response. Write access, like the Secret URL read: samples can hold customer data and API answers.
 * Archived workflows still answer, since reading changes nothing.
 */
export const listWorkflowSamples = async ({
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
    const workflow = await prisma.workflow.findUnique({
      where: { id: params.workflowId },
      select: { id: true, workspaceId: true },
    });
    // Unknown and foreign workflows answer alike, as every workflow operation does.
    if (!workflow) throw new WorkflowForbiddenError();
    const authorized = await ctx.authorize(workflow.workspaceId, "readWrite");
    if (authorized instanceof Response) return authorized;

    const rows = await prisma.workflowSample.findMany({
      where: { workflowId: workflow.id },
      select: { source: true, sample: true, updatedAt: true },
      orderBy: { source: "asc" },
    });
    const data: TWorkflowSampleList = rows.map((row) => ({
      source: row.source,
      sample: row.sample,
      updatedAt: row.updatedAt.toISOString(),
    }));
    return successResponse(data, { requestId });
  } catch (error) {
    return toProblemResponse(error, ctx);
  }
};
