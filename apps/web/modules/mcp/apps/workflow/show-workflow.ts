import type { CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";
import { ZWorkflowResource, ZWorkflowRunListItem } from "@formbricks/workflows";
import { problemInternalError } from "@/app/api/v3/lib/response";
import { buildWorkflowApiContext, workflowsHandlers } from "@/app/api/v3/workflows/lib/context";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { type TMcpToolContext, getMcpAuthentication, getMcpRequestId, getMcpToolAuthInfo } from "../../auth";
import { responseToMcpToolResult } from "../../errors";
import { buildListWorkflowRunsSearchParams } from "../../tools/workflows";
import type { TMcpShowWorkflowOutput } from "./output-schema";
import { buildShowWorkflowSummary } from "./summary";

/** How many runs the view opens with. One page of the runs list, never one request per run. */
export const SHOW_WORKFLOW_RECENT_RUNS_LIMIT = 10;

export const ZMcpShowWorkflowInput = z
  .object({
    workflowId: z.cuid2().describe("Workflow to show."),
  })
  .strict();
export type TMcpShowWorkflowInput = z.infer<typeof ZMcpShowWorkflowInput>;

const ZRunsBody = z.object({ data: z.array(ZWorkflowRunListItem) });

async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

async function readProblemDetail(response: Response): Promise<string> {
  const body = await readBody(response);
  const detail =
    typeof body === "object" && body !== null && "detail" in body
      ? (body as { detail: unknown }).detail
      : null;
  return typeof detail === "string" ? detail : "The recent runs could not be loaded.";
}

/**
 * `show_workflow`: the same operation as `get_workflow` plus one bounded page of the runs-list operation
 * `list_workflow_runs` calls. The runs are listed with the workspace the workflow itself resolved to, so a
 * caller can never reach runs of a workflow the get did not authorize, and neither read is repeated per
 * run. A runs failure degrades to a workflow without runs, because the workflow is the point of the view.
 */
export async function showWorkflow(
  input: TMcpShowWorkflowInput,
  mcpCtx: TMcpToolContext
): Promise<CallToolResult> {
  const authInfo = getMcpToolAuthInfo(mcpCtx);
  const requestId = getMcpRequestId(authInfo);
  const ctx = buildWorkflowApiContext(getMcpAuthentication(authInfo), requestId, MCP_API_ROUTE);

  const workflowResponse = await workflowsHandlers.get({ ctx, params: { workflowId: input.workflowId } });
  if (!workflowResponse.ok) {
    return await responseToMcpToolResult(workflowResponse, requestId);
  }

  const workflow = z.object({ data: ZWorkflowResource }).safeParse(await readBody(workflowResponse));
  if (!workflow.success) {
    return await responseToMcpToolResult(
      problemInternalError(requestId, "The workflow could not be read.", MCP_API_ROUTE),
      requestId
    );
  }

  const runsRequestUrl = new URL(MCP_API_ROUTE, "https://mcp.internal");
  runsRequestUrl.search = buildListWorkflowRunsSearchParams({
    workspaceId: workflow.data.data.workspaceId,
    workflowId: input.workflowId,
    limit: SHOW_WORKFLOW_RECENT_RUNS_LIMIT,
  }).toString();
  const runsResponse = await workflowsHandlers.listRuns({ req: new Request(runsRequestUrl), ctx });

  let recentRuns: z.infer<typeof ZWorkflowRunListItem>[] = [];
  let recentRunsError: string | undefined;
  if (runsResponse.ok) {
    const runs = ZRunsBody.safeParse(await readBody(runsResponse));
    if (runs.success) {
      recentRuns = runs.data.data;
    } else {
      recentRunsError = "The recent runs could not be read.";
    }
  } else {
    recentRunsError = await readProblemDetail(runsResponse);
  }

  const structuredContent: TMcpShowWorkflowOutput = {
    workflow: workflow.data.data,
    recentRuns,
    ...(recentRunsError ? { recentRunsError } : {}),
    requestId,
  };

  const summary = buildShowWorkflowSummary(workflow.data.data, recentRuns);
  return {
    structuredContent,
    content: [
      {
        type: "text",
        text: recentRunsError ? `${summary} Recent runs unavailable: ${recentRunsError}` : summary,
      },
    ],
  };
}
