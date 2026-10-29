import type { McpServer } from "@modelcontextprotocol/server";
import {
  deleteV3OrganizationInvite,
  resendV3OrganizationInvite,
} from "@/app/api/v3/organizations/lib/invite-management";
import {
  type TV3InviteDeleteResource,
  type TV3InviteResendResource,
  ZV3InviteDeleteResource,
  ZV3InviteResendResource,
} from "@/app/api/v3/organizations/lib/members-schemas";
import { inviteV3OrganizationMember } from "@/app/api/v3/organizations/lib/operations";
import { ZV3InviteMemberResource } from "@/app/api/v3/organizations/lib/schemas";
import { registerScopedTool } from "./guard-scopes";
import { runIdSummaryMutation } from "./id-summary-mutation";
import {
  type TMcpDeleteInviteInput,
  type TMcpInviteMemberInput,
  type TMcpResendInviteInput,
  ZMcpDeleteInviteInput,
  ZMcpInviteMemberInput,
  ZMcpResendInviteInput,
} from "./invites-schemas";
import { mcpToolOutput } from "./output-schemas";
import { MEMBER_WRITE_SCOPES } from "./setup-scopes";

const ZMcpInviteMemberOutput = mcpToolOutput(ZV3InviteMemberResource);
const ZMcpInviteResendOutput = mcpToolOutput(ZV3InviteResendResource);
const ZMcpInviteDeleteOutput = mcpToolOutput(ZV3InviteDeleteResource);

const summarizeResend = (invite: TV3InviteResendResource): string =>
  `Invite ${invite.inviteId} resent (expires ${invite.expiresAt}); email ${invite.emailSent ? "sent" : "not sent"}.`;

const summarizeDeletion = (invite: TV3InviteDeleteResource): string =>
  invite.status === "preview"
    ? `Not deleted: a preview of deleting invite ${invite.inviteId} (role ${invite.role}). Call again with confirm true after the person approves.`
    : `Invite ${invite.inviteId} deleted.`;

export function registerInviteTools(server: McpServer): void {
  registerScopedTool(
    server,
    "invite_member",
    {
      title: "Invite member",
      description:
        "Invite a person to an organization as a member or manager, by email. Nothing is sent unless confirm is true: without it you only get a preview of who would be invited with which role, so show that to the person and set confirm only after they approve. The preview runs the same checks, so an address that already has a pending invite or is already a member is refused with a 409 there too. Needs an organization owner or manager (as a signed-in person); only an owner may invite a manager. Sends an email to the address.",
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
    MEMBER_WRITE_SCOPES,
    ({ organizationId, ...body }: TMcpInviteMemberInput, ctx) =>
      runIdSummaryMutation(
        ctx,
        { action: "created", resource: "invite", logContext: { organizationId } },
        (args) => inviteV3OrganizationMember({ organizationId, body, ...args }),
        ZV3InviteMemberResource,
        (invite) =>
          invite.status === "preview"
            ? `Not sent: a preview of one invite with role ${invite.role} to organization ${invite.organizationId}. Call again with confirm true after the person approves.`
            : `Invite ${invite.inviteId} created with role ${invite.role}; email ${invite.emailSent ? "sent" : "not sent"}.`
      )
  );

  registerScopedTool(
    server,
    "resend_invite",
    {
      title: "Resend invite",
      description:
        "Resend a pending or expired invite: its expiry moves seven days out and the email is sent again. Take inviteId from list_members. Needs an organization owner or manager (signed in, not an API key); a manager cannot resend an invite for the owner role. Rate limited like the first send. emailSent false means the invite was refreshed but the email could not be sent.",
      inputSchema: ZMcpResendInviteInput,
      outputSchema: ZMcpInviteResendOutput,
      audit: { action: "updated", targetType: "invite", targetIdArg: "inviteId" },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    MEMBER_WRITE_SCOPES,
    ({ organizationId, inviteId }: TMcpResendInviteInput, ctx) =>
      runIdSummaryMutation(
        ctx,
        { action: "updated", resource: "invite", logContext: { organizationId } },
        (args) => resendV3OrganizationInvite({ organizationId, inviteId, ...args }),
        ZV3InviteResendResource,
        summarizeResend
      )
  );

  registerScopedTool(
    server,
    "delete_invite",
    {
      title: "Delete invite",
      description:
        "Delete a pending invite so its link stops working. Nothing is deleted unless confirm is true: without it you only get a preview, so show it and set confirm only after the person approves. Take inviteId from list_members. Needs an organization owner or manager (signed in, not an API key); a manager cannot delete an invite for the owner role.",
      inputSchema: ZMcpDeleteInviteInput,
      outputSchema: ZMcpInviteDeleteOutput,
      audit: { action: "deleted", targetType: "invite", targetIdArg: "inviteId" },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    MEMBER_WRITE_SCOPES,
    ({ organizationId, inviteId, confirm }: TMcpDeleteInviteInput, ctx) =>
      runIdSummaryMutation(
        ctx,
        { action: "deleted", resource: "invite", logContext: { organizationId } },
        (args) => deleteV3OrganizationInvite({ organizationId, inviteId, confirm, ...args }),
        ZV3InviteDeleteResource,
        summarizeDeletion
      )
  );
}
