import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getV3AccountContext } from "@/app/api/v3/account/lib/context";
import { ZV3AccountContext } from "@/app/api/v3/account/lib/schemas";
import { inviteV3OrganizationMember, updateV3Organization } from "@/app/api/v3/organizations/lib/operations";
import { ZV3InviteMemberResource, ZV3OrganizationResource } from "@/app/api/v3/organizations/lib/schemas";
import { setV3WorkspaceBranding } from "@/app/api/v3/workspaces/lib/branding";
import { createV3Workspace, updateV3Workspace } from "@/app/api/v3/workspaces/lib/setup";
import {
  ZV3WorkspaceBrandingResource,
  ZV3WorkspaceSetupResource,
} from "@/app/api/v3/workspaces/lib/setup-schemas";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { getMcpAuthentication, getMcpRequestId, getMcpToolAuthInfo } from "../auth";
import { responseToMcpToolResult } from "../errors";
import { registerScopedTool } from "./guard-scopes";
import { mcpToolOutput } from "./output-schemas";
import { runMcpMutation } from "./run-mcp-mutation";
import {
  type TMcpCreateWorkspaceInput,
  type TMcpGetAccountContextInput,
  type TMcpInviteMemberInput,
  type TMcpSetWorkspaceBrandingInput,
  type TMcpUpdateOrganizationInput,
  type TMcpUpdateWorkspaceInput,
  ZMcpCreateWorkspaceInput,
  ZMcpGetAccountContextInput,
  ZMcpInviteMemberInput,
  ZMcpSetWorkspaceBrandingInput,
  ZMcpUpdateOrganizationInput,
  ZMcpUpdateWorkspaceInput,
} from "./setup-schemas";

const ZMcpAccountContextOutput = mcpToolOutput(ZV3AccountContext);
const ZMcpOrganizationOutput = mcpToolOutput(ZV3OrganizationResource);
const ZMcpWorkspaceSetupOutput = mcpToolOutput(ZV3WorkspaceSetupResource);
const ZMcpWorkspaceBrandingOutput = mcpToolOutput(ZV3WorkspaceBrandingResource);
const ZMcpInviteMemberOutput = mcpToolOutput(ZV3InviteMemberResource);

/**
 * The account context is the first call of the setup guide, made before the caller knows a workspace, so
 * like `list_workspaces` it admits any resource read scope. It is derived from the caller's own
 * memberships and key grants, so admitting any of them exposes nothing extra.
 */
const ACCOUNT_CONTEXT_SCOPES: { anyOf: [string, ...string[]] } = {
  anyOf: [
    "surveys:read",
    "workflows:read",
    "feedbackRecords:read",
    "responses:read",
    "contacts:read",
    "webhooks:read",
    "audit:read",
  ],
};

/**
 * No new OAuth scope (ADR 0018): the writes reuse `surveys:write`, which is only the first gate. Every
 * operation enforces the real role check itself, so a connection that may edit surveys still cannot
 * rename an organization, create a workspace or invite anyone unless its person is an owner or manager.
 */
const SETUP_WRITE_SCOPES: [string, ...string[]] = ["surveys:write"];

/**
 * Replace the text a client shows the model with one built from ids, counts and fixed words.
 *
 * `structuredContent` keeps the full result, names included, because a name is data the agent was asked to
 * read. The text half goes into the model's context as if the person had said it, and workspace and
 * organization names are written by other people (ADR 0017), so it carries none. An error result, or a
 * body that does not match the shape, is returned untouched.
 */
function withIdSummary<TData>(
  result: CallToolResult,
  schema: z.ZodType<TData>,
  summarize: (data: TData) => string
): CallToolResult {
  if (result.isError) return result;
  const body = result.structuredContent as { data?: unknown } | undefined;
  const parsed = schema.safeParse(body?.data);
  if (!parsed.success) return result;

  return { ...result, content: [{ type: "text", text: summarize(parsed.data) }] };
}

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? "" : "s"}`;

export function summarizeAccountContext(context: z.infer<typeof ZV3AccountContext>): string {
  const subject =
    context.principal === "user" && context.user ? `user ${context.user.id}` : "an API key principal";
  const organizations = context.organizations.map(
    (organization) =>
      `organization ${organization.id} (role ${organization.role ?? "none"}, ${plural(organization.workspaces.length, "workspace")}${
        organization.workspaces.length > 0
          ? `: ${organization.workspaces.map((workspace) => workspace.id).join(", ")}`
          : ""
      })`
  );

  return [
    `Account context for ${subject}: ${plural(context.setup.organizationCount, "organization")}, ${plural(context.setup.workspaceCount, "workspace")}, ${plural(context.setup.surveyCount, "survey")}, branding ${context.setup.brandingSet ? "set" : "not set"}.`,
    organizations.length > 0 ? `${organizations.join("; ")}.` : "",
    "Names, roles and per-workspace setup facts are in structuredContent.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function registerSetupTools(server: McpServer): void {
  registerScopedTool(
    server,
    "get_account_context",
    {
      title: "Get account context",
      description:
        "Read what is known about the person you work for: who they are, their role in each organization, the organizations and workspaces they can reach, and derived setup facts (workspace and survey counts, whether branding is set, whether they may create a workspace). Call it first when setting up an account. Nothing is stored: it is safe to call again at any time.",
      inputSchema: ZMcpGetAccountContextInput,
      outputSchema: ZMcpAccountContextOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    ACCOUNT_CONTEXT_SCOPES,
    async (_input: TMcpGetAccountContextInput, ctx) => {
      const authInfo = getMcpToolAuthInfo(ctx);
      const requestId = getMcpRequestId(authInfo);
      const response = await getV3AccountContext({
        authentication: getMcpAuthentication(authInfo),
        requestId,
        instance: MCP_API_ROUTE,
      });

      return withIdSummary(
        await responseToMcpToolResult(response, requestId),
        ZV3AccountContext,
        summarizeAccountContext
      );
    }
  );

  registerScopedTool(
    server,
    "update_organization",
    {
      title: "Rename organization",
      description:
        "Rename an organization. Needs an organization owner or manager (as a signed-in person, not an API key). Only the name can be changed.",
      inputSchema: ZMcpUpdateOrganizationInput,
      outputSchema: ZMcpOrganizationOutput,
      audit: { action: "updated", targetType: "organization", targetIdArg: "organizationId" },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    SETUP_WRITE_SCOPES,
    async ({ organizationId, ...body }: TMcpUpdateOrganizationInput, ctx) =>
      withIdSummary(
        await runMcpMutation(
          ctx,
          { action: "updated", resource: "organization", logContext: { organizationId } },
          ({ authentication, requestId, auditLog }) =>
            updateV3Organization({
              organizationId,
              body,
              authentication,
              requestId,
              instance: MCP_API_ROUTE,
              auditLog,
            })
        ),
        ZV3OrganizationResource,
        (organization) => `Organization ${organization.id} saved.`
      )
  );

  registerScopedTool(
    server,
    "create_workspace",
    {
      title: "Create workspace",
      description:
        "Create a workspace in an organization. Needs an organization owner or manager (as a signed-in person, not an API key), and fails when the plan's workspace limit is reached. A new organization has none; this is how the first one is made. Branding is set separately with set_workspace_branding.",
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
    SETUP_WRITE_SCOPES,
    async (input: TMcpCreateWorkspaceInput, ctx) =>
      withIdSummary(
        await runMcpMutation(
          ctx,
          { action: "created", resource: "workspace", logContext: { organizationId: input.organizationId } },
          ({ authentication, requestId, auditLog }) =>
            createV3Workspace({
              body: input,
              authentication,
              requestId,
              instance: MCP_API_ROUTE,
              auditLog,
            })
        ),
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
    SETUP_WRITE_SCOPES,
    async ({ workspaceId, ...body }: TMcpUpdateWorkspaceInput, ctx) =>
      withIdSummary(
        await runMcpMutation(
          ctx,
          { action: "updated", resource: "workspace", logContext: { workspaceId } },
          ({ authentication, requestId, auditLog }) =>
            updateV3Workspace({
              workspaceId,
              body,
              authentication,
              requestId,
              instance: MCP_API_ROUTE,
              auditLog,
            })
        ),
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
    SETUP_WRITE_SCOPES,
    async ({ workspaceId, ...body }: TMcpSetWorkspaceBrandingInput, ctx) =>
      withIdSummary(
        await runMcpMutation(
          ctx,
          { action: "updated", resource: "workspace", logContext: { workspaceId } },
          ({ authentication, requestId, auditLog }) =>
            setV3WorkspaceBranding({
              workspaceId,
              body,
              authentication,
              requestId,
              instance: MCP_API_ROUTE,
              auditLog,
            })
        ),
        ZV3WorkspaceBrandingResource,
        (branding) =>
          `Branding saved for workspace ${branding.workspaceId} (brand colour ${branding.brandColor ? "set" : "not set"}, logo ${branding.logoUrl ? "set" : "not set"}).`
      )
  );

  registerScopedTool(
    server,
    "invite_member",
    {
      title: "Invite member",
      description:
        "Invite a person to an organization as a member or manager, by email. Nothing is sent unless confirm is true: without it you only get a preview of who would be invited with which role, so show that to the person and set confirm only after they approve. Needs an organization owner or manager (as a signed-in person); only an owner may invite a manager. Sends an email to the address.",
      inputSchema: ZMcpInviteMemberInput,
      outputSchema: ZMcpInviteMemberOutput,
      audit: { action: "created", targetType: "invite" },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    SETUP_WRITE_SCOPES,
    async ({ organizationId, ...body }: TMcpInviteMemberInput, ctx) =>
      withIdSummary(
        await runMcpMutation(
          ctx,
          { action: "created", resource: "invite", logContext: { organizationId } },
          ({ authentication, requestId, auditLog }) =>
            inviteV3OrganizationMember({
              organizationId,
              body,
              authentication,
              requestId,
              instance: MCP_API_ROUTE,
              auditLog,
            })
        ),
        ZV3InviteMemberResource,
        (invite) =>
          invite.status === "preview"
            ? `Not sent: a preview of one invite with role ${invite.role} to organization ${invite.organizationId}. Call again with confirm true after the person approves.`
            : `Invite ${invite.inviteId} created with role ${invite.role}; email ${invite.emailSent ? "sent" : "not sent"}.`
      )
  );
}
