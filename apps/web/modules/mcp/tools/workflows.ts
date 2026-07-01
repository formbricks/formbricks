import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildWorkflowApiContext, workflowsHandlers } from "@/app/api/v3/workflows/lib/context";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { getMcpAuthentication, getMcpRequestId } from "../auth";
import { responseToMcpToolResult } from "../errors";
import {
  type TMcpGetWorkflowInput,
  type TMcpGetWorkflowRunInput,
  type TMcpListWorkflowRunsInput,
  type TMcpListWorkflowsInput,
  type TMcpTestWorkflowInput,
  ZMcpGetWorkflowInput,
  ZMcpGetWorkflowRunInput,
  ZMcpListWorkflowRunsInput,
  ZMcpListWorkflowsInput,
  ZMcpTestWorkflowInput,
} from "./workflow-schemas";

export function buildListWorkflowsSearchParams(input: TMcpListWorkflowsInput): URLSearchParams {
  const searchParams = new URLSearchParams();

  searchParams.set("workspaceId", input.workspaceId);
  searchParams.set("limit", String(input.limit ?? 20));

  if (input.cursor) {
    searchParams.set("cursor", input.cursor);
  }

  if (input.sortBy) {
    searchParams.set("sortBy", input.sortBy);
  }

  if (input.filter?.name?.contains) {
    searchParams.set("filter[name][contains]", input.filter.name.contains);
  }

  input.filter?.status?.in?.forEach((status) => {
    searchParams.append("filter[status][in]", status);
  });

  return searchParams;
}

export function buildListWorkflowRunsSearchParams(input: TMcpListWorkflowRunsInput): URLSearchParams {
  const searchParams = new URLSearchParams();

  searchParams.set("workspaceId", input.workspaceId);
  searchParams.set("limit", String(input.limit ?? 20));

  if (input.cursor) {
    searchParams.set("cursor", input.cursor);
  }

  if (input.workflowId) {
    searchParams.set("workflowId", input.workflowId);
  }

  if (input.responseId) {
    searchParams.set("responseId", input.responseId);
  }

  input.filter?.status?.in?.forEach((status) => {
    searchParams.append("filter[status][in]", status);
  });

  if (input.filter?.isDryRun !== undefined) {
    searchParams.set("filter[isDryRun][eq]", String(input.filter.isDryRun));
  }

  return searchParams;
}

/**
 * The framework-agnostic workflow list handlers read query params off a `Request` (via
 * `new URL(req.url).searchParams`). MCP has no incoming HTTP request, so build a synthetic one — the
 * handler only reads the search params, so the (absolute, required by `new URL`) host is irrelevant.
 */
function buildWorkflowsListRequest(searchParams: URLSearchParams): Request {
  const url = new URL(MCP_API_ROUTE, "http://mcp.internal");
  url.search = searchParams.toString();
  return new Request(url);
}

export function registerWorkflowTools(server: McpServer): void {
  server.registerTool(
    "list_workflows",
    {
      title: "List workflows",
      description: "List workflows in a Formbricks workspace using the v3 Workflows API contract.",
      inputSchema: ZMcpListWorkflowsInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (input: TMcpListWorkflowsInput, extra) => {
      const requestId = getMcpRequestId(extra.authInfo);
      const ctx = buildWorkflowApiContext(getMcpAuthentication(extra.authInfo), requestId, MCP_API_ROUTE);
      const response = await workflowsHandlers.list({
        req: buildWorkflowsListRequest(buildListWorkflowsSearchParams(input)),
        ctx,
      });

      return await responseToMcpToolResult(response, requestId);
    }
  );

  server.registerTool(
    "get_workflow",
    {
      title: "Get workflow",
      description: "Get one Formbricks workflow using the v3 Workflows API contract.",
      inputSchema: ZMcpGetWorkflowInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (input: TMcpGetWorkflowInput, extra) => {
      const requestId = getMcpRequestId(extra.authInfo);
      const ctx = buildWorkflowApiContext(getMcpAuthentication(extra.authInfo), requestId, MCP_API_ROUTE);
      const response = await workflowsHandlers.get({ ctx, params: { workflowId: input.workflowId } });

      return await responseToMcpToolResult(response, requestId);
    }
  );

  server.registerTool(
    "list_workflow_runs",
    {
      title: "List workflow runs",
      description:
        "List workflow runs for a Formbricks workspace (newest first) using the v3 Workflows API contract.",
      inputSchema: ZMcpListWorkflowRunsInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (input: TMcpListWorkflowRunsInput, extra) => {
      const requestId = getMcpRequestId(extra.authInfo);
      const ctx = buildWorkflowApiContext(getMcpAuthentication(extra.authInfo), requestId, MCP_API_ROUTE);
      const response = await workflowsHandlers.listRuns({
        req: buildWorkflowsListRequest(buildListWorkflowRunsSearchParams(input)),
        ctx,
      });

      return await responseToMcpToolResult(response, requestId);
    }
  );

  server.registerTool(
    "get_workflow_run",
    {
      title: "Get workflow run",
      description:
        "Get one Formbricks workflow run with its ordered step logs using the v3 Workflows API contract.",
      inputSchema: ZMcpGetWorkflowRunInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (input: TMcpGetWorkflowRunInput, extra) => {
      const requestId = getMcpRequestId(extra.authInfo);
      const ctx = buildWorkflowApiContext(getMcpAuthentication(extra.authInfo), requestId, MCP_API_ROUTE);
      const response = await workflowsHandlers.getRun({ ctx, params: { runId: input.runId } });

      return await responseToMcpToolResult(response, requestId);
    }
  );

  server.registerTool(
    "test_workflow",
    {
      title: "Test workflow (dry-run)",
      description: [
        "Dry-run a Formbricks workflow using the v3 Workflows API contract:",
        "validate its live definition would execute and resolve the trigger's survey + ending cards.",
        "No run is persisted and no side effects occur; the response reports { ok, problems }.",
      ].join(" "),
      annotations: {
        // Dry-run: validates + mock-executes with all side effects suppressed, so no world mutation.
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: ZMcpTestWorkflowInput.shape,
    },
    async (input: TMcpTestWorkflowInput, extra) => {
      const requestId = getMcpRequestId(extra.authInfo);
      const ctx = buildWorkflowApiContext(getMcpAuthentication(extra.authInfo), requestId, MCP_API_ROUTE);
      const response = await workflowsHandlers.testWorkflow({
        ctx,
        params: { workflowId: input.workflowId },
      });

      return await responseToMcpToolResult(response, requestId);
    }
  );
}
