"use server";

import { z } from "zod";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { ZId, ZUuid } from "@formbricks/types/common";
import {
  AuthenticationError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  ValidationError,
} from "@formbricks/types/errors";
import { ZMembershipUpdateInput } from "@formbricks/types/memberships";
import { assertCan, can } from "@/lib/authorization";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getOrganization } from "@/lib/organization/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { getOrganizationIdFromInviteId } from "@/lib/utils/helper";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { getAccessControlPermission } from "@/modules/ee/license-check/lib/utils";
import { updateInvite } from "@/modules/ee/role-management/lib/invite";
import { updateMembership } from "@/modules/ee/role-management/lib/membership";
import { ZInviteUpdateInput } from "@/modules/ee/role-management/types/invites";
import { getInvite } from "@/modules/organization/settings/teams/lib/invite";
import { getOrganizationOwnerCount } from "@/modules/organization/settings/teams/lib/membership";

export const checkRoleManagementPermission = async (organizationId: string) => {
  const organization = await getOrganization(organizationId);
  if (!organization) {
    throw new ResourceNotFoundError("Organization", organizationId);
  }

  const isAccessControlAllowed = await getAccessControlPermission(organizationId);
  if (!isAccessControlAllowed) {
    throw new OperationNotAllowedError("Role management is not allowed for this organization");
  }
};

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
    ctx.auditLoggingCtx.oldObject = { ...(await getInvite(parsedInput.inviteId)) };

    const result = await updateInvite(parsedInput.inviteId, parsedInput.data);

    ctx.auditLoggingCtx.newObject = { ...(await getInvite(parsedInput.inviteId)) };
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
    // `organization.manage_access` *is* this decision in the central vocabulary. The SpiceDB
    // evaluator maps `USER_MANAGEMENT_MINIMUM_ROLE` onto the schema (`owner` → write, `manager` →
    // manage_access, `disabled` → deny). Asking centrally makes SpiceDB authoritative for this role
    // mutation — the highest-risk one in the product. The check
    // below it stays `organization.manage`, which is a different and additionally required
    // capability, so both remain.
    const canManageAccess = await can({ type: "user", id: ctx.user.id }, "organization.manage_access", {
      type: "organization",
      id: parsedInput.organizationId,
    });

    if (!canManageAccess) {
      throw new OperationNotAllowedError("User management is not allowed for your role");
    }

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
