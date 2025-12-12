"use server";

import { OrganizationRole } from "@prisma/client";
import { z } from "zod";
import { ZId, ZUuid } from "@formbricks/types/common";
import { AuthenticationError, OperationNotAllowedError, ValidationError } from "@formbricks/types/errors";
import { TOrganizationRole, ZOrganizationRole } from "@formbricks/types/memberships";
import { INVITE_DISABLED, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { createInviteToken } from "@/lib/jwt";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { getOrganizationIdFromInviteId } from "@/lib/utils/helper";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { checkRoleManagementPermission } from "@/modules/ee/role-management/actions";
import { getTeamsWhereUserIsAdmin } from "@/modules/ee/teams/lib/roles";
import { sendInviteMemberEmail } from "@/modules/email";
import {
  deleteMembership,
  getMembershipsByUserId,
  getOrganizationOwnerCount,
} from "@/modules/organization/settings/teams/lib/membership";
import { deleteInvite, getInvite, inviteUser, resendInvite } from "./lib/invite";

const ZDeleteInviteAction = z.object({
  inviteId: ZUuid,
  organizationId: ZId,
});

export const deleteInviteAction = authenticatedActionClient.schema(ZDeleteInviteAction).action(
  withAuditLogging(
    "deleted",
    "invite",
    async ({ ctx, parsedInput }: { ctx: AuthenticatedActionClientCtx; parsedInput: Record<string, any> }) => {
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId: parsedInput.organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
        ],
      });
      ctx.auditLoggingCtx.organizationId = parsedInput.organizationId;
      ctx.auditLoggingCtx.inviteId = parsedInput.inviteId;
      ctx.auditLoggingCtx.oldObject = { ...(await getInvite(parsedInput.inviteId)) };
      return await deleteInvite(parsedInput.inviteId);
    }
  )
);

const ZCreateInviteTokenAction = z.object({
  inviteId: ZUuid,
});

export const createInviteTokenAction = authenticatedActionClient
  .schema(ZCreateInviteTokenAction)
  .action(async ({ parsedInput, ctx }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromInviteId(parsedInput.inviteId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });

    const invite = await getInvite(parsedInput.inviteId);
    if (!invite) {
      throw new ValidationError("Invite not found");
    }
    const inviteToken = createInviteToken(parsedInput.inviteId, invite.email, {
      expiresIn: "7d",
    });

    return { inviteToken: encodeURIComponent(inviteToken) };
  });

const ZDeleteMembershipAction = z.object({
  userId: ZId,
  organizationId: ZId,
});

export const deleteMembershipAction = authenticatedActionClient.schema(ZDeleteMembershipAction).action(
  withAuditLogging(
    "deleted",
    "membership",
    async ({ ctx, parsedInput }: { ctx: AuthenticatedActionClientCtx; parsedInput: Record<string, any> }) => {
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId: parsedInput.organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
        ],
      });

      if (parsedInput.userId === ctx.user.id) {
        throw new OperationNotAllowedError("You cannot delete yourself from the organization");
      }

      const currentMembership = await getMembershipByUserIdOrganizationId(
        ctx.user.id,
        parsedInput.organizationId
      );

      if (!currentMembership) {
        throw new AuthenticationError("Not a member of this organization");
      }

      const membership = await getMembershipByUserIdOrganizationId(
        parsedInput.userId,
        parsedInput.organizationId
      );

      if (!membership) {
        throw new AuthenticationError("Not a member of this organization");
      }

      const isOwner = membership.role === "owner";

      if (currentMembership.role === "manager" && isOwner) {
        throw new OperationNotAllowedError("You cannot delete the owner of the organization");
      }

      if (isOwner) {
        const ownerCount = await getOrganizationOwnerCount(parsedInput.organizationId);

        if (ownerCount <= 1) {
          throw new ValidationError("You cannot delete the last owner of the organization");
        }
      }

      ctx.auditLoggingCtx.organizationId = parsedInput.organizationId;
      ctx.auditLoggingCtx.membershipId = `${parsedInput.userId}-${parsedInput.organizationId}`;
      ctx.auditLoggingCtx.oldObject = membership;
      return await deleteMembership(parsedInput.userId, parsedInput.organizationId);
    }
  )
);

const ZResendInviteAction = z.object({
  inviteId: ZUuid,
  organizationId: ZId,
});

export const resendInviteAction = authenticatedActionClient.schema(ZResendInviteAction).action(
  withAuditLogging(
    "updated",
    "invite",
    async ({ ctx, parsedInput }: { ctx: AuthenticatedActionClientCtx; parsedInput: Record<string, any> }) => {
      if (INVITE_DISABLED) {
        throw new OperationNotAllowedError("Invite are disabled");
      }

      const inviteOrganizationId = await getOrganizationIdFromInviteId(parsedInput.inviteId);

      if (inviteOrganizationId !== parsedInput.organizationId) {
        throw new ValidationError("Invite does not belong to the organization");
      }

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId: parsedInput.organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
        ],
      });

      const invite = await getInvite(parsedInput.inviteId);

      ctx.auditLoggingCtx.organizationId = parsedInput.organizationId;
      ctx.auditLoggingCtx.inviteId = parsedInput.inviteId;
      ctx.auditLoggingCtx.oldObject = { ...invite };
      const updatedInvite = await resendInvite(parsedInput.inviteId);
      ctx.auditLoggingCtx.newObject = updatedInvite;
      await sendInviteMemberEmail(
        parsedInput.inviteId,
        updatedInvite.email,
        invite?.creator?.name ?? "",
        updatedInvite.name ?? ""
      );
      return updatedInvite;
    }
  )
);

const validateTeamAdminInvitePermissions = (
  inviterRole: TOrganizationRole,
  inviterAdminTeams: string[],
  inviteRole: TOrganizationRole,
  inviteTeamIds: string[]
): void => {
  const isOrgOwnerOrManager = inviterRole === "owner" || inviterRole === "manager";
  const isTeamAdmin = inviterAdminTeams.length > 0;

  if (!isOrgOwnerOrManager && !isTeamAdmin) {
    throw new AuthenticationError("Only organization owners, managers, or team admins can invite members");
  }

  // Team admins have restrictions
  if (isTeamAdmin && !isOrgOwnerOrManager) {
    if (inviteRole !== "member") {
      throw new OperationNotAllowedError("Team admins can only invite users as members");
    }

    const invalidTeams = inviteTeamIds.filter((id) => !inviterAdminTeams.includes(id));
    if (invalidTeams.length > 0) {
      throw new OperationNotAllowedError("Team admins can only add users to teams where they are admin");
    }

    if (inviteTeamIds.length === 0) {
      throw new ValidationError("Team admins must add invited users to at least one team");
    }
  }
};

const ZInviteUserAction = z.object({
  organizationId: ZId,
  email: z.string(),
  name: z.string().trim().min(1, "Name is required"),
  role: ZOrganizationRole,
  teamIds: z.array(ZId),
});

export const inviteUserAction = authenticatedActionClient.schema(ZInviteUserAction).action(
  withAuditLogging(
    "created",
    "invite",
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZInviteUserAction>;
    }) => {
      if (INVITE_DISABLED) {
        throw new AuthenticationError("Invite disabled");
      }

      if (!IS_FORMBRICKS_CLOUD && parsedInput.role === OrganizationRole.billing) {
        throw new ValidationError("Billing role is not allowed");
      }

      const currentUserMembership = await getMembershipByUserIdOrganizationId(
        ctx.user.id,
        parsedInput.organizationId
      );
      if (!currentUserMembership) {
        throw new AuthenticationError("User not a member of this organization");
      }

      const isOrgOwnerOrManager =
        currentUserMembership.role === "owner" || currentUserMembership.role === "manager";

      // Fetch user's admin teams (empty array if owner/manager to skip unnecessary query)
      const userAdminTeams = isOrgOwnerOrManager
        ? []
        : await getTeamsWhereUserIsAdmin(ctx.user.id, parsedInput.organizationId);

      const isTeamAdmin = userAdminTeams.length > 0;

      if (!isOrgOwnerOrManager && !isTeamAdmin) {
        throw new AuthenticationError("Not authorized to invite members");
      }

      if (isOrgOwnerOrManager) {
        // Standard org-level auth check
        await checkAuthorizationUpdated({
          userId: ctx.user.id,
          organizationId: parsedInput.organizationId,
          access: [
            {
              type: "organization",
              roles: ["owner", "manager"],
            },
          ],
        });
      }

      // Validate team admin restrictions
      validateTeamAdminInvitePermissions(
        currentUserMembership.role,
        userAdminTeams,
        parsedInput.role,
        parsedInput.teamIds
      );

      if (currentUserMembership.role === "manager" && parsedInput.role !== "member") {
        throw new OperationNotAllowedError("Managers can only invite users as members");
      }

      if (parsedInput.role !== "owner" || parsedInput.teamIds.length > 0) {
        await checkRoleManagementPermission(parsedInput.organizationId);
      }

      const inviteId = await inviteUser({
        organizationId: parsedInput.organizationId,
        invitee: {
          email: parsedInput.email,
          name: parsedInput.name,
          role: parsedInput.role,
          teamIds: parsedInput.teamIds,
        },
        currentUserId: ctx.user.id,
      });

      ctx.auditLoggingCtx.organizationId = parsedInput.organizationId;
      ctx.auditLoggingCtx.inviteId = inviteId;
      ctx.auditLoggingCtx.newObject = {
        email: parsedInput.email,
        name: parsedInput.name,
        role: parsedInput.role,
        teamIds: parsedInput.teamIds,
      };

      if (inviteId) {
        await sendInviteMemberEmail(inviteId, parsedInput.email, ctx.user.name ?? "", parsedInput.name ?? "");
      }

      return inviteId;
    }
  )
);

const ZLeaveOrganizationAction = z.object({
  organizationId: ZId,
});

export const leaveOrganizationAction = authenticatedActionClient.schema(ZLeaveOrganizationAction).action(
  withAuditLogging(
    "deleted",
    "membership",
    async ({ ctx, parsedInput }: { ctx: AuthenticatedActionClientCtx; parsedInput: Record<string, any> }) => {
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId: parsedInput.organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager", "billing", "member"],
          },
        ],
      });

      const membership = await getMembershipByUserIdOrganizationId(ctx.user.id, parsedInput.organizationId);

      if (!membership) {
        throw new AuthenticationError("Not a member of this organization");
      }

      const { isOwner } = getAccessFlags(membership.role);

      const isMultiOrgEnabled = await getIsMultiOrgEnabled();

      if (isOwner) {
        throw new OperationNotAllowedError("You cannot leave an organization you own");
      }

      if (!isMultiOrgEnabled) {
        throw new OperationNotAllowedError(
          "You cannot leave the organization because you are the only owner and organization deletion is disabled"
        );
      }

      const memberships = await getMembershipsByUserId(ctx.user.id);
      if (!memberships || memberships?.length <= 1) {
        throw new ValidationError("You cannot leave the only organization you are a member of");
      }

      ctx.auditLoggingCtx.organizationId = parsedInput.organizationId;
      ctx.auditLoggingCtx.membershipId = `${ctx.user.id}-${parsedInput.organizationId}`;
      ctx.auditLoggingCtx.oldObject = membership;

      return await deleteMembership(ctx.user.id, parsedInput.organizationId);
    }
  )
);
