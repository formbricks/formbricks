import type { McpServer } from "@modelcontextprotocol/server";
import { setV3WorkspaceBranding } from "@/app/api/v3/workspaces/lib/branding";
import { getV3WorkspaceCustomCss, patchV3WorkspaceCustomCss } from "@/app/api/v3/workspaces/lib/custom-css";
import {
  ZV3CustomCssWarnings,
  ZV3WorkspaceCustomCssResource,
} from "@/app/api/v3/workspaces/lib/custom-css-schemas";
import { listV3Workspaces } from "@/app/api/v3/workspaces/lib/operations";
import { createV3Workspace, updateV3Workspace } from "@/app/api/v3/workspaces/lib/setup";
import {
  ZV3WorkspaceBrandingResource,
  ZV3WorkspaceSetupResource,
} from "@/app/api/v3/workspaces/lib/setup-schemas";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { getMcpAuthentication, getMcpRequestId, getMcpToolAuthInfo } from "../auth";
import { responseToMcpToolResult } from "../errors";
import { registerScopedTool } from "./guard-scopes";
import { runIdSummaryMutation } from "./id-summary-mutation";
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
import { WORKSPACE_WRITE_SCOPES } from "./setup-scopes";
import {
  type TMcpCreateWorkspaceInput,
  type TMcpSetWorkspaceBrandingInput,
  type TMcpUpdateWorkspaceInput,
  ZMcpCreateWorkspaceInput,
  ZMcpSetWorkspaceBrandingInput,
  ZMcpUpdateWorkspaceInput,
} from "./workspaces-schemas";

/**
 * Both workspace custom CSS tools answer the same resource; a write adds the processing `warnings` beside
 * `data`, exactly as the REST PATCH does.
 */
export const ZMcpWorkspaceCustomCssOutput = mcpToolOutput(ZV3WorkspaceCustomCssResource)
  .extend({ warnings: ZV3CustomCssWarnings.optional() })
  .strict();

const ZMcpWorkspaceSetupOutput = mcpToolOutput(ZV3WorkspaceSetupResource);
const ZMcpWorkspaceBrandingOutput = mcpToolOutput(ZV3WorkspaceBrandingResource);

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
    // included, which a responses-only token can hold now that the pair is advertised (ENG-3470), and
    // `account:read`, so a token that only reads the account context can still name its workspaces.
    {
      anyOf: [
        "surveys:read",
        "workflows:read",
        "feedbackRecords:read",
        "responses:read",
        "contacts:read",
        "webhooks:read",
        "audit:read",
        "account:read",
      ],
    },
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

  // Workspace setup (ADR 0018). `workspaces:write` is only the first gate: the operations enforce the
  // organization owner or manager role themselves.
  registerScopedTool(
    server,
    "create_workspace",
    {
      title: "Create workspace",
      description:
        "Create a workspace in an organization. Needs an organization owner or manager signed in as a person: API keys cannot create workspaces (the call is refused with a 403), even one with manage access, because creating a workspace is an organization-level change. Fails when the plan's workspace limit is reached. A new organization has none; this is how the first one is made. Branding is set separately with set_workspace_branding.",
      inputSchema: ZMcpCreateWorkspaceInput,
      outputSchema: ZMcpWorkspaceSetupOutput,
      audit: { action: "created", targetType: "workspace" },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    WORKSPACE_WRITE_SCOPES,
    (input: TMcpCreateWorkspaceInput, ctx) =>
      runIdSummaryMutation(
        ctx,
        { action: "created", resource: "workspace", logContext: { organizationId: input.organizationId } },
        (args) => createV3Workspace({ body: input, ...args }),
        ZV3WorkspaceSetupResource,
        (workspace) => `Workspace ${workspace.id} created in organization ${workspace.organizationId}.`
      )
  );

  registerScopedTool(
    server,
    "update_workspace",
    {
      title: "Update workspace",
      description:
        "Rename a workspace or set its channel (link, app, website) and industry. Only the fields you pass change. Needs an organization owner or manager, or an API key with manage access to the workspace. Colours and logo go through set_workspace_branding.",
      inputSchema: ZMcpUpdateWorkspaceInput,
      outputSchema: ZMcpWorkspaceSetupOutput,
      audit: { action: "updated", targetType: "workspace", targetIdArg: "workspaceId" },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    WORKSPACE_WRITE_SCOPES,
    ({ workspaceId, ...body }: TMcpUpdateWorkspaceInput, ctx) =>
      runIdSummaryMutation(
        ctx,
        { action: "updated", resource: "workspace", logContext: { workspaceId } },
        (args) => updateV3Workspace({ workspaceId, body, ...args }),
        ZV3WorkspaceSetupResource,
        (workspace) => `Workspace ${workspace.id} saved.`
      )
  );

  registerScopedTool(
    server,
    "set_workspace_branding",
    {
      title: "Set workspace branding",
      description:
        "Set a workspace's brand colour and/or logo. A brand colour derives the matching survey colours and leaves other styling as it is. A logo is an https image URL (png, jpeg or webp, at most 1 MB) that the server downloads and stores; it replaces the current logo, and null removes it. Needs an organization owner or manager, or an API key with manage access to the workspace. Research the brand yourself first and show the person what will be saved.",
      inputSchema: ZMcpSetWorkspaceBrandingInput,
      outputSchema: ZMcpWorkspaceBrandingOutput,
      audit: { action: "updated", targetType: "workspace", targetIdArg: "workspaceId" },
      // A replaced logo's stored file is deleted and the previous colours are not returned.
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    WORKSPACE_WRITE_SCOPES,
    ({ workspaceId, ...body }: TMcpSetWorkspaceBrandingInput, ctx) =>
      runIdSummaryMutation(
        ctx,
        { action: "updated", resource: "workspace", logContext: { workspaceId } },
        (args) => setV3WorkspaceBranding({ workspaceId, body, ...args }),
        ZV3WorkspaceBrandingResource,
        (branding) =>
          `Branding saved for workspace ${branding.workspaceId} (brand colour ${branding.brandColor ? "set" : "not set"}, logo ${branding.logoUrl ? "set" : "not set"}).`
      )
  );
}
