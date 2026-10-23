import type { McpServer } from "@modelcontextprotocol/server";
import { getV3WorkspaceCustomCss, patchV3WorkspaceCustomCss } from "@/app/api/v3/workspaces/lib/custom-css";
import {
  ZV3CustomCssWarnings,
  ZV3WorkspaceCustomCssResource,
} from "@/app/api/v3/workspaces/lib/custom-css-schemas";
import { listV3Workspaces } from "@/app/api/v3/workspaces/lib/operations";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { getMcpAuthentication, getMcpRequestId, getMcpToolAuthInfo } from "../auth";
import { responseToMcpToolResult } from "../errors";
import { registerScopedTool } from "./guard-scopes";
import { mcpToolOutput } from "./output-schemas";
import { runMcpMutation } from "./run-mcp-mutation";
import {
  type TMcpGetWorkspaceCustomCssInput,
  type TMcpListWorkspacesInput,
  type TMcpPatchWorkspaceCustomCssInput,
  ZMcpGetWorkspaceCustomCssInput,
  ZMcpListWorkspacesInput,
  ZMcpPatchWorkspaceCustomCssInput,
} from "./schemas";

/**
 * Both workspace custom CSS tools answer the same resource; a write adds the processing `warnings` beside
 * `data`, exactly as the REST PATCH does.
 */
export const ZMcpWorkspaceCustomCssOutput = mcpToolOutput(ZV3WorkspaceCustomCssResource)
  .extend({ warnings: ZV3CustomCssWarnings.optional() })
  .strict();

export function registerWorkspaceTools(server: McpServer): void {
  // list_workspaces is the workspaceId-discovery prerequisite for the survey, workflow, feedback-record
  // AND response tools, so it gates on ANY resource read scope rather than a single one. auth.ts's
  // baseline is "at least one resource scope" (MCP_RESOURCE_SCOPES), so a workflows-only,
  // feedbackRecords-only or responses-only token is a legitimate client and must still be able to
  // discover its workspaceId. The result is derived from the caller's own memberships/key grants, so
  // admitting any read scope exposes nothing extra.
  registerScopedTool(
    server,
    "list_workspaces",
    {
      title: "List workspaces",
      description:
        "List the Formbricks workspaces the authenticated user can access. Use this to discover the workspaceId required by the survey, workflow, feedback-record and response tools.",
      inputSchema: ZMcpListWorkspacesInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    // Every tool group needs a workspaceId first, so this has to admit any of them — `responses:read`
    // included, which a responses-only token can hold now that the pair is advertised (ENG-3470).
    { anyOf: ["surveys:read", "workflows:read", "feedbackRecords:read", "responses:read"] },
    async (_input: TMcpListWorkspacesInput, ctx) => {
      const authInfo = getMcpToolAuthInfo(ctx);
      const requestId = getMcpRequestId(authInfo);
      const response = await listV3Workspaces({
        authentication: getMcpAuthentication(authInfo),
        requestId,
        instance: MCP_API_ROUTE,
      });

      return await responseToMcpToolResult(response, requestId);
    }
  );

  // ENG-3641. `surveys:read` covers reading shared survey CSS, like any survey content. The write is
  // gated on `surveys:write`, but the scope is only the first gate: the operation still requires an
  // organization owner or manager (OAuth / session user) or a `manage` grant (API key) on the workspace.
  registerScopedTool(
    server,
    "get_workspace_custom_css",
    {
      title: "Get workspace custom CSS",
      description:
        "Read a workspace's shared survey CSS source (light and dark), its one recoverable previous revision, whether stored CSS is being delivered (status), and whether you may edit it (canEdit, planAllowed).",
      inputSchema: ZMcpGetWorkspaceCustomCssInput,
      outputSchema: ZMcpWorkspaceCustomCssOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    ["surveys:read"],
    async (input: TMcpGetWorkspaceCustomCssInput, ctx) => {
      const authInfo = getMcpToolAuthInfo(ctx);
      const requestId = getMcpRequestId(authInfo);
      const response = await getV3WorkspaceCustomCss({
        workspaceId: input.workspaceId,
        authentication: getMcpAuthentication(authInfo),
        requestId,
        instance: MCP_API_ROUTE,
      });

      return await responseToMcpToolResult(response, requestId);
    }
  );

  registerScopedTool(
    server,
    "patch_workspace_custom_css",
    {
      title: "Save workspace custom CSS",
      description: [
        "Save or clear the shared survey CSS that applies to every survey in a workspace.",
        "`customCss` replaces both fields: `{ light, dark }` source, each a CSS string or null; null clears both.",
        "Run validate_survey with operation customCss first to preview warnings. Removed constructs come back as warnings; invalid CSS is rejected and the saved CSS is kept.",
        "Needs an organization owner or manager (or an API key with manage access), and the Scale plan on Cloud to add or edit; clearing never needs the plan.",
        "The replaced CSS stays recoverable as `previous` until the next change.",
      ].join(" "),
      inputSchema: ZMcpPatchWorkspaceCustomCssInput,
      outputSchema: ZMcpWorkspaceCustomCssOutput,
      audit: { action: "updated", targetType: "workspace", targetIdArg: "workspaceId" },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    ["surveys:write"],
    async (input: TMcpPatchWorkspaceCustomCssInput, ctx) =>
      runMcpMutation(
        ctx,
        { action: "updated", resource: "workspace", logContext: { workspaceId: input.workspaceId } },
        ({ authentication, requestId, auditLog }) =>
          patchV3WorkspaceCustomCss({
            workspaceId: input.workspaceId,
            body: { customCss: input.customCss },
            authentication,
            requestId,
            instance: MCP_API_ROUTE,
            auditLog,
          })
      )
  );
}
