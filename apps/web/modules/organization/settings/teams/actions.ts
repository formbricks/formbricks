"use server";

import { INVITE_DISABLED, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { createInviteToken } from "@/lib/jwt";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromInviteId } from "@/lib/utils/helper";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { checkRoleManagementPermission } from "@/modules/ee/role-management/actions";
import { sendInviteMemberEmail } from "@/modules/email";
import {
  deleteMembership,
  getMembershipsByUserId,
  getOrganizationOwnerCount,
} from "@/modules/organization/settings/teams/lib/membership";
import { OrganizationRole } from "@prisma/client";
import { z } from "zod";
import { ZId, ZUuid } from "@formbricks/types/common";
import { AuthenticationError, OperationNotAllowedError, ValidationError } from "@formbricks/types/errors";
import { ZOrganizationRole } from "@formbricks/types/memberships";
import { deleteInvite, getInvite, inviteUser, resendInvite } from "./lib/invite";

const ZDeleteInviteAction = z.object({
  inviteId: ZUuid,
  organizationId: ZId,
});

export const deleteInviteAction = authenticatedActionClient
  .schema(ZDeleteInviteAction)
  .action(async ({ parsedInput, ctx }) => {
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
    return await deleteInvite(parsedInput.inviteId);
  });

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

export const deleteMembershipAction = authenticatedActionClient
  .schema(ZDeleteMembershipAction)
  .action(async ({ parsedInput, ctx }) => {
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

    return await deleteMembership(parsedInput.userId, parsedInput.organizationId);
  });

const ZResendInviteAction = z.object({
  inviteId: ZUuid,
  organizationId: ZId,
});

export const resendInviteAction = authenticatedActionClient
  .schema(ZResendInviteAction)
  .action(async ({ parsedInput, ctx }) => {
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
    const updatedInvite = await resendInvite(parsedInput.inviteId);
    await sendInviteMemberEmail(
      parsedInput.inviteId,
      updatedInvite.email,
      invite?.creator.name ?? "",
      updatedInvite.name ?? "",
      undefined,
      ctx.user.locale
    );
  });

const ZInviteUserAction = z.object({
  organizationId: ZId,
  email: z.string(),
  name: z.string(),
  role: ZOrganizationRole,
  teamIds: z.array(z.string()),
});

export const inviteUserAction = authenticatedActionClient
  .schema(ZInviteUserAction)
  .action(async ({ parsedInput, ctx }) => {
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

    if (inviteId) {
      await sendInviteMemberEmail(
        inviteId,
        parsedInput.email,
        ctx.user.name ?? "",
        parsedInput.name ?? "",
        false,
        undefined
      );
    }

    return inviteId;
  });

const ZLeaveOrganizationAction = z.object({
  organizationId: ZId,
});

export const leaveOrganizationAction = authenticatedActionClient
  .schema(ZLeaveOrganizationAction)
  .action(async ({ parsedInput, ctx }) => {
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

    return await deleteMembership(ctx.user.id, parsedInput.organizationId);
  });
