"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromInviteId, getOrganizationIdFromTeamId } from "@/lib/utils/helper";
import { getIsMultiOrgEnabled, getRoleManagementPermission } from "@/modules/ee/license-check/lib/utils";
import { checkRoleManagementPermission } from "@/modules/ee/role-management/actions";
import {
  deleteMembership,
  getMembershipsByUserId,
  getOrganizationOwnerCount,
} from "@/modules/ee/teams/team-list/lib/membership";
import { createTeam, deleteTeam, getTeamDetails, updateTeam } from "@/modules/ee/teams/team-list/lib/team";
import { ZTeamSettingsFormSchema } from "@/modules/ee/teams/team-list/types/teams";
import { sendInviteMemberEmail } from "@/modules/email";
import { OrganizationRole } from "@prisma/client";
import { z } from "zod";
import { INVITE_DISABLED, IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { deleteInvite, getInvite, inviteUser, resendInvite } from "@formbricks/lib/invite/service";
import { createInviteToken } from "@formbricks/lib/jwt";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganization } from "@formbricks/lib/organization/service";
import { ZId, ZUuid } from "@formbricks/types/common";
import { AuthenticationError, OperationNotAllowedError, ValidationError } from "@formbricks/types/errors";
import { ZOrganizationRole } from "@formbricks/types/memberships";

const ZCreateTeamAction = z.object({
  organizationId: z.string().cuid(),
  name: z.string(),
});

export const createTeamAction = authenticatedActionClient
  .schema(ZCreateTeamAction)
  .action(async ({ ctx, parsedInput }) => {
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
    await checkRoleManagementPermission(parsedInput.organizationId);

    return await createTeam(parsedInput.organizationId, parsedInput.name);
  });

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
  inviteId: z.string(),
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
      throw new AuthenticationError("You cannot delete yourself from the organization");
    }

    const membership = await getMembershipByUserIdOrganizationId(
      parsedInput.userId,
      parsedInput.organizationId
    );

    if (!membership) {
      throw new AuthenticationError("Not a member of this organization");
    }

    const isOwner = membership.role === "owner";

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
      throw new AuthenticationError("Invite disabled");
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

    if (parsedInput.role !== "owner" || parsedInput.teamIds.length > 0) {
      const organization = await getOrganization(parsedInput.organizationId);
      if (!organization) {
        throw new Error("Organization not found");
      }

      const canDoRoleManagement = await getRoleManagementPermission(organization);

      if (!canDoRoleManagement) {
        throw new OperationNotAllowedError("Role management is disabled");
      }
    }

    const invite = await inviteUser({
      organizationId: parsedInput.organizationId,
      invitee: {
        email: parsedInput.email,
        name: parsedInput.name,
        role: parsedInput.role,
        teamIds: parsedInput.teamIds,
      },
      currentUserId: ctx.user.id,
    });

    if (invite) {
      await sendInviteMemberEmail(
        invite.id,
        parsedInput.email,
        ctx.user.name ?? "",
        parsedInput.name ?? "",
        false,
        undefined,
        ctx.user.locale
      );
    }

    return invite;
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

const ZGetTeamDetailsAction = z.object({
  teamId: ZId,
});

export const getTeamDetailsAction = authenticatedActionClient
  .schema(ZGetTeamDetailsAction)
  .action(async ({ parsedInput, ctx }) => {
    const organizationId = await getOrganizationIdFromTeamId(parsedInput.teamId);

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });

    await checkRoleManagementPermission(organizationId);

    return await getTeamDetails(parsedInput.teamId);
  });

const ZDeleteTeamAction = z.object({
  teamId: ZId,
});

export const deleteTeamAction = authenticatedActionClient
  .schema(ZDeleteTeamAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromTeamId(parsedInput.teamId);

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });

    await checkRoleManagementPermission(organizationId);
    return await deleteTeam(parsedInput.teamId);
  });

const ZUpdateTeamAction = z.object({
  teamId: ZId,
  data: ZTeamSettingsFormSchema,
});

export const updateTeamAction = authenticatedActionClient
  .schema(ZUpdateTeamAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromTeamId(parsedInput.teamId);

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });

    await checkRoleManagementPermission(organizationId);

    return await updateTeam(parsedInput.teamId, parsedInput.data);
  });
