import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "@formbricks/logger";
import { buildV3AuditLog, queueV3AuditLog } from "@/app/api/v3/lib/audit";
import { buildWorkflowApiContext, workflowsHandlers } from "@/app/api/v3/workflows/lib/context";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { getMcpAuthentication, getMcpRequestId } from "../auth";
import { responseToMcpToolResult } from "../errors";
import {
  type TMcpCreateWorkflowInput,
  type TMcpDuplicateWorkflowInput,
  type TMcpGetWorkflowInput,
  type TMcpGetWorkflowRunInput,
  type TMcpListWorkflowRunsInput,
  type TMcpListWorkflowsInput,
  type TMcpPatchWorkflowInput,
  type TMcpTestWorkflowInput,
  type TMcpWorkflowIdInput,
  ZMcpCreateWorkflowInput,
  ZMcpDuplicateWorkflowInput,
  ZMcpGetWorkflowInput,
  ZMcpGetWorkflowRunInput,
  ZMcpListWorkflowRunsInput,
  ZMcpListWorkflowsInput,
  ZMcpPatchWorkflowInput,
  ZMcpTestWorkflowInput,
  ZMcpWorkflowIdInput,
} from "./workflow-schemas";

type WorkflowApiContext = ReturnType<typeof buildWorkflowApiContext>;

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
 * `new URL(req.url).searchParams`). MCP has no incoming HTTP request, so build a synthetic one that
 * is never dispatched — the handler only reads the search params, so the scheme/host are inert
 * placeholders (an absolute base is required solely to satisfy `new URL`).
 */
function buildWorkflowsListRequest(searchParams: URLSearchParams): Request {
  const url = new URL(MCP_API_ROUTE, "https://mcp.internal");
  url.search = searchParams.toString();
  return new Request(url);
}

/**
 * The create/patch/duplicate handlers read + validate a JSON body off `req.text()`. Build a
 * synthetic (never-dispatched) POST carrying the body; an empty object is sent for optional-body
 * operations so the handler never sees an empty string.
 */
function buildWorkflowsBodyRequest(body: unknown): Request {
  return new Request(new URL(MCP_API_ROUTE, "https://mcp.internal"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

/**
 * Run a workflow mutation with the same audit lifecycle the v3 route wrapper provides: build the
 * audit log, inject it into the context (the handlers populate it via ctx.recordAudit post-mutation),
 * mark success/failure, and always queue it. Mirrors the survey mutation tools.
 */
async function runWorkflowMutation(
  extra: { authInfo?: NonNullable<Parameters<typeof getMcpAuthentication>[0]> },
  action: Parameters<typeof buildV3AuditLog>[1],
  run: (ctx: WorkflowApiContext) => Promise<Response>
): Promise<CallToolResult> {
  const requestId = getMcpRequestId(extra.authInfo);
  const authentication = getMcpAuthentication(extra.authInfo);
  const log = logger.withContext({ requestId });
  const auditLog = buildV3AuditLog(authentication, action, "workflow", MCP_API_ROUTE);

  try {
    const ctx = buildWorkflowApiContext(authentication, requestId, MCP_API_ROUTE, auditLog ?? undefined);
    const response = await run(ctx);

    if (auditLog) {
      if (response.ok) {
        auditLog.status = "success";
      } else {
        auditLog.eventId = requestId;
      }
    }

    await queueV3AuditLog(auditLog, requestId, log);
    return await responseToMcpToolResult(response, requestId);
  } catch (error) {
    if (auditLog) {
      auditLog.eventId = requestId;
      await queueV3AuditLog(auditLog, requestId, log);
    }

    throw error;
  }
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

  server.registerTool(
    "create_workflow",
    {
      title: "Create workflow",
      description: "Create a Formbricks workflow (always as a draft) using the v3 Workflows API contract.",
      inputSchema: ZMcpCreateWorkflowInput.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (input: TMcpCreateWorkflowInput, extra) =>
      runWorkflowMutation(extra, "created", (ctx) =>
        workflowsHandlers.create({ req: buildWorkflowsBodyRequest(input), ctx })
      )
  );

  server.registerTool(
    "patch_workflow",
    {
      title: "Patch workflow",
      description: [
        "Update a Formbricks workflow using the v3 Workflows API patch contract.",
        "Provided top-level fields replace that whole subtree; definition edits are only accepted while draft or disabled.",
      ].join(" "),
      inputSchema: ZMcpPatchWorkflowInput.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (input: TMcpPatchWorkflowInput, extra) =>
      runWorkflowMutation(extra, "updated", (ctx) =>
        workflowsHandlers.patch({
          req: buildWorkflowsBodyRequest(input.data),
          ctx,
          params: { workflowId: input.workflowId },
        })
      )
  );

  server.registerTool(
    "duplicate_workflow",
    {
      title: "Duplicate workflow",
      description:
        "Duplicate a Formbricks workflow as a new draft (empty run + version history) using the v3 Workflows API contract.",
      inputSchema: ZMcpDuplicateWorkflowInput.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (input: TMcpDuplicateWorkflowInput, extra) =>
      runWorkflowMutation(extra, "created", (ctx) =>
        workflowsHandlers.duplicate({
          req: buildWorkflowsBodyRequest(input.name ? { name: input.name } : {}),
          ctx,
          params: { workflowId: input.workflowId },
        })
      )
  );

  server.registerTool(
    "delete_workflow",
    {
      title: "Delete workflow",
      description: "Delete a Formbricks workflow using the v3 Workflows API contract.",
      inputSchema: ZMcpWorkflowIdInput.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (input: TMcpWorkflowIdInput, extra) =>
      runWorkflowMutation(extra, "deleted", (ctx) =>
        workflowsHandlers.delete({ ctx, params: { workflowId: input.workflowId } })
      )
  );

  server.registerTool(
    "enable_workflow",
    {
      title: "Enable workflow",
      description: [
        "Enable a Formbricks workflow using the v3 Workflows API contract:",
        "validate executability, snapshot an immutable version, and make it live.",
        "Once live it runs on matching survey responses and can send emails.",
      ].join(" "),
      inputSchema: ZMcpWorkflowIdInput.shape,
      annotations: {
        readOnlyHint: false,
        // Enabling activates a live, email-sending workflow — high impact.
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (input: TMcpWorkflowIdInput, extra) =>
      runWorkflowMutation(extra, "updated", (ctx) =>
        workflowsHandlers.enable({ ctx, params: { workflowId: input.workflowId } })
      )
  );

  server.registerTool(
    "disable_workflow",
    {
      title: "Disable workflow",
      description:
        "Disable a live Formbricks workflow (stops future runs) using the v3 Workflows API contract.",
      inputSchema: ZMcpWorkflowIdInput.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (input: TMcpWorkflowIdInput, extra) =>
      runWorkflowMutation(extra, "updated", (ctx) =>
        workflowsHandlers.disable({ ctx, params: { workflowId: input.workflowId } })
      )
  );

  server.registerTool(
    "archive_workflow",
    {
      title: "Archive workflow",
      description: "Archive a Formbricks workflow using the v3 Workflows API contract.",
      inputSchema: ZMcpWorkflowIdInput.shape,
      annotations: {
        readOnlyHint: false,
        // Archiving soft-deletes and excludes the workflow from default reads.
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (input: TMcpWorkflowIdInput, extra) =>
      runWorkflowMutation(extra, "updated", (ctx) =>
        workflowsHandlers.archive({ ctx, params: { workflowId: input.workflowId } })
      )
  );

  server.registerTool(
    "unarchive_workflow",
    {
      title: "Unarchive workflow",
      description: "Unarchive a Formbricks workflow (back to draft) using the v3 Workflows API contract.",
      inputSchema: ZMcpWorkflowIdInput.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (input: TMcpWorkflowIdInput, extra) =>
      runWorkflowMutation(extra, "updated", (ctx) =>
        workflowsHandlers.unarchive({ ctx, params: { workflowId: input.workflowId } })
      )
  );
}
