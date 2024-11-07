"use server";

import {
  deleteMembership,
  getMembershipsByUserId,
} from "@/app/(app)/environments/[environmentId]/settings/(organization)/general/lib/membership";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromInviteId } from "@/lib/utils/helper";
import { sendInviteMemberEmail } from "@/modules/email";
import { OrganizationRole } from "@prisma/client";
import { z } from "zod";
import { getIsMultiOrgEnabled } from "@formbricks/ee/lib/service";
import { INVITE_DISABLED, IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { deleteInvite, getInvite, inviteUser, resendInvite } from "@formbricks/lib/invite/service";
import { createInviteToken } from "@formbricks/lib/jwt";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { deleteOrganization, updateOrganization } from "@formbricks/lib/organization/service";
import { ZId, ZUuid } from "@formbricks/types/common";
import { AuthenticationError, OperationNotAllowedError, ValidationError } from "@formbricks/types/errors";
import { ZOrganizationRole } from "@formbricks/types/memberships";
import { ZOrganizationUpdateInput } from "@formbricks/types/organizations";

const ZUpdateOrganizationNameAction = z.object({
  organizationId: ZId,
  data: ZOrganizationUpdateInput.pick({ name: true }),
});

export const updateOrganizationNameAction = authenticatedActionClient
  .schema(ZUpdateOrganizationNameAction)
  .action(async ({ parsedInput, ctx }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: parsedInput.organizationId,
      access: [
        {
          type: "organization",
          schema: ZOrganizationUpdateInput.pick({ name: true }),
          data: parsedInput.data,
          roles: ["owner"],
        },
      ],
    });

    return await updateOrganization(parsedInput.organizationId, parsedInput.data);
  });

const ZUpdateOrganizationAIEnabledAction = z.object({
  organizationId: ZId,
  data: ZOrganizationUpdateInput.pick({ isAIEnabled: true }),
});

export const updateOrganizationAIEnabledAction = authenticatedActionClient
  .schema(ZUpdateOrganizationAIEnabledAction)
  .action(async ({ parsedInput, ctx }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: parsedInput.organizationId,
      access: [
        {
          type: "organization",
          schema: ZOrganizationUpdateInput.pick({ isAIEnabled: true }),
          data: parsedInput.data,
          roles: ["owner", "manager"],
        },
      ],
    });

    return await updateOrganization(parsedInput.organizationId, parsedInput.data);
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

    const membership = await getMembershipByUserIdOrganizationId(ctx.user.id, parsedInput.organizationId);

    if (!membership) {
      throw new AuthenticationError("Not a member of this organization");
    }

    const memberships = await getMembershipsByUserId(ctx.user.id);
    const isLastOwner = memberships?.filter((m) => m.organizationRole === "owner").length === 1;
    if (membership.organizationRole === "owner" && isLastOwner) {
      throw new ValidationError("You cannot delete the last owner of the organization");
    }

    return await deleteMembership(parsedInput.userId, parsedInput.organizationId);
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

    if (membership.organizationRole === "owner") {
      throw new ValidationError("You cannot leave an organization you own");
    }

    const memberships = await getMembershipsByUserId(ctx.user.id);
    if (!memberships || memberships?.length <= 1) {
      throw new ValidationError("You cannot leave the only organization you are a member of");
    }

    return await deleteMembership(ctx.user.id, parsedInput.organizationId);
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
  organizationRole: ZOrganizationRole,
});

export const inviteUserAction = authenticatedActionClient
  .schema(ZInviteUserAction)
  .action(async ({ parsedInput, ctx }) => {
    if (INVITE_DISABLED) {
      throw new AuthenticationError("Invite disabled");
    }

    if (!IS_FORMBRICKS_CLOUD && parsedInput.organizationRole === OrganizationRole.billing) {
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

    const invite = await inviteUser({
      organizationId: parsedInput.organizationId,
      invitee: {
        email: parsedInput.email,
        name: parsedInput.name,
        organizationRole: parsedInput.organizationRole,
      },
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

const ZDeleteOrganizationAction = z.object({
  organizationId: ZId,
});

export const deleteOrganizationAction = authenticatedActionClient
  .schema(ZDeleteOrganizationAction)
  .action(async ({ parsedInput, ctx }) => {
    const isMultiOrgEnabled = await getIsMultiOrgEnabled();
    if (!isMultiOrgEnabled) throw new OperationNotAllowedError("Organization deletion disabled");

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

    return await deleteOrganization(parsedInput.organizationId);
  });
