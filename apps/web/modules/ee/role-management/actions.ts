"use server";

import { z } from "zod";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { ZId, ZUuid } from "@formbricks/types/common";
import { AuthenticationError, OperationNotAllowedError, ValidationError } from "@formbricks/types/errors";
import { ZMembershipUpdateInput } from "@formbricks/types/memberships";
import { assertCan } from "@/lib/authorization";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { getOrganizationIdFromInviteId } from "@/lib/utils/helper";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { updateInvite } from "@/modules/ee/role-management/lib/invite";
import { updateMembership } from "@/modules/ee/role-management/lib/membership";
import { checkRoleManagementPermission } from "@/modules/ee/role-management/lib/permission";
import { assertUserManagementAllowed } from "@/modules/ee/role-management/lib/user-management";
import { ZInviteUpdateInput } from "@/modules/ee/role-management/types/invites";
import { getInvite } from "@/modules/organization/settings/teams/lib/invite";
import { getOrganizationOwnerCount } from "@/modules/organization/settings/teams/lib/membership";

const ZUpdateInviteAction = z.object({
  inviteId: ZUuid,
  data: ZInviteUpdateInput,
});

export type TUpdateInviteAction = z.infer<typeof ZUpdateInviteAction>;

export const updateInviteAction = authenticatedActionClient.inputSchema(ZUpdateInviteAction).action(
  withAuditLogging("updated", "invite", async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromInviteId(parsedInput.inviteId);

    const currentUserMembership = await getMembershipByUserIdOrganizationId(ctx.user.id, organizationId);
    if (!currentUserMembership) {
      throw new AuthenticationError("User not a member of this organization");
    }

    await assertUserManagementAllowed(ctx.user.id, organizationId);
    await assertCan({ type: "user", id: ctx.user.id }, "organization.manage", {
      type: "organization",
      id: organizationId,
    });
    await applyRateLimit(rateLimitConfigs.actions.stateMutation, organizationId);

    if (!IS_FORMBRICKS_CLOUD && parsedInput.data.role === "billing") {
      throw new ValidationError("Billing role is not allowed");
    }

    if (currentUserMembership.role === "manager" && parsedInput.data.role !== "member") {
      throw new OperationNotAllowedError("Managers can only invite members");
    }

    await checkRoleManagementPermission(organizationId);

    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.inviteId = parsedInput.inviteId;
    const oldInvite = { ...(await getInvite(parsedInput.inviteId)) };
    ctx.auditLoggingCtx.oldObject = oldInvite;

    const result = await updateInvite(parsedInput.inviteId, parsedInput.data, {
      allowOwnerInvite: currentUserMembership.role === "owner",
    });

    // Built from the write rather than re-read: `getInvite` is request-cached, so a second read in this
    // action would return the snapshot from before the update.
    ctx.auditLoggingCtx.newObject = { ...oldInvite, ...parsedInput.data };
    return result;
  })
);

const ZUpdateMembershipAction = z.object({
  userId: ZId,
  organizationId: ZId,
  data: ZMembershipUpdateInput,
});

export const updateMembershipAction = authenticatedActionClient.inputSchema(ZUpdateMembershipAction).action(
  withAuditLogging("updated", "membership", async ({ ctx, parsedInput }) => {
    const currentUserMembership = await getMembershipByUserIdOrganizationId(
      ctx.user.id,
      parsedInput.organizationId
    );
    if (!currentUserMembership) {
      throw new AuthenticationError("User not a member of this organization");
    }
    await assertUserManagementAllowed(ctx.user.id, parsedInput.organizationId);
    await assertCan({ type: "user", id: ctx.user.id }, "organization.manage", {
      type: "organization",
      id: parsedInput.organizationId,
    });
    await applyRateLimit(rateLimitConfigs.actions.stateMutation, parsedInput.organizationId);

    if (!IS_FORMBRICKS_CLOUD && parsedInput.data.role === "billing") {
      throw new ValidationError("Billing role is not allowed");
    }

    if (currentUserMembership.role === "manager" && parsedInput.data.role !== "member") {
      throw new OperationNotAllowedError("Managers can only assign users to the member role");
    }

    const targetMembership = await getMembershipByUserIdOrganizationId(
      parsedInput.userId,
      parsedInput.organizationId
    );
    if (currentUserMembership.role !== "owner" && targetMembership?.role === "owner") {
      throw new OperationNotAllowedError("Only owners can change the role of an owner");
    }

    await checkRoleManagementPermission(parsedInput.organizationId);

    ctx.auditLoggingCtx.organizationId = parsedInput.organizationId;
    ctx.auditLoggingCtx.membershipId = `${parsedInput.userId}-${parsedInput.organizationId}`;
    ctx.auditLoggingCtx.oldObject = targetMembership;

    const isDemotingOwner = targetMembership?.role === "owner" && parsedInput.data.role !== "owner";

    // The owner count and the role update must be one atomic unit: read then act, in two separate
    // statements, lets two owners demoting each other concurrently both read "more than one owner"
    // and both writes land, leaving zero owners. Serializable isolation makes Postgres abort one of
    // the two transactions instead.
    const result = isDemotingOwner
      ? await prisma.$transaction(
          async (tx) => {
            const ownerCount = await getOrganizationOwnerCount(parsedInput.organizationId, tx);

            if (ownerCount <= 1) {
              throw new ValidationError("You cannot demote the last owner of the organization");
            }

            return updateMembership(parsedInput.userId, parsedInput.organizationId, parsedInput.data, tx);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        )
      : await updateMembership(parsedInput.userId, parsedInput.organizationId, parsedInput.data);

    ctx.auditLoggingCtx.newObject = result;
    return result;
  })
);
