import type { McpServer } from "@modelcontextprotocol/server";
import { inviteV3OrganizationMember } from "@/app/api/v3/organizations/lib/operations";
import { ZV3InviteMemberResource } from "@/app/api/v3/organizations/lib/schemas";
import { registerScopedTool } from "./guard-scopes";
import { runIdSummaryMutation } from "./id-summary-mutation";
import { type TMcpInviteMemberInput, ZMcpInviteMemberInput } from "./invites-schemas";
import { mcpToolOutput } from "./output-schemas";
import { MEMBER_WRITE_SCOPES } from "./setup-scopes";

const ZMcpInviteMemberOutput = mcpToolOutput(ZV3InviteMemberResource);

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
}
