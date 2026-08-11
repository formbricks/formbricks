"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { AuthenticationError } from "@formbricks/types/errors";
import { ZUserEmail, ZUserName } from "@formbricks/types/user";
import { INVITE_DISABLED } from "@/lib/constants";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { sendInviteMemberEmail } from "@/modules/email";
import { inviteUser } from "@/modules/setup/organization/[organizationId]/invite/lib/invite";

const ZInviteOrganizationMemberAction = z.object({
  email: ZUserEmail,
  organizationId: ZId,
  name: ZUserName,
});

export const inviteOrganizationMemberAction = authenticatedActionClient
  .inputSchema(ZInviteOrganizationMemberAction)
  .action(
    withAuditLogging("created", "invite", async ({ ctx, parsedInput }) => {
      if (INVITE_DISABLED) {
        throw new AuthenticationError("Invite disabled");
      }

      // Owner-only, deliberately narrower than the org settings invite path: this action takes no
      // role and `inviteUser` always persists an owner invite, so allowing managers here would let
      // them mint owners and bypass the "managers can only invite users as members" rule enforced in
      // `modules/organization/settings/teams/actions.ts`. Nothing legitimate is lost — the only entry
      // to this screen is the redirect right after `createOrganizationAction`, which makes the
      // creator an owner.
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId: parsedInput.organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner"],
          },
        ],
      });

      ctx.auditLoggingCtx.organizationId = parsedInput.organizationId;

      // Shares the inviteMember namespace so the per-org cap bounds invite-spam across both the
      // settings and onboarding invite paths combined (abusive orgs sit in this setup flow).
      await applyRateLimit(rateLimitConfigs.actions.inviteMember, parsedInput.organizationId);

      const invitedUserId = await inviteUser({
        organizationId: parsedInput.organizationId,
        invitee: {
          email: parsedInput.email,
          name: parsedInput.name,
        },
        currentUserId: ctx.user.id,
      });

      await sendInviteMemberEmail(invitedUserId, parsedInput.email, ctx.user.name, "");

      ctx.auditLoggingCtx.inviteId = invitedUserId;
      ctx.auditLoggingCtx.newObject = {
        invitedUserId,
        email: parsedInput.email,
        name: parsedInput.name,
      };

      return invitedUserId;
    })
  );
