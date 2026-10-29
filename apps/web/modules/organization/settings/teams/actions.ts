"use server";

import { z } from "zod";
import { prisma } from "@formbricks/database";
import { ZId, ZUuid } from "@formbricks/types/common";
import { AuthenticationError, OperationNotAllowedError, ValidationError } from "@formbricks/types/errors";
import { assertCan } from "@/lib/authorization";
import { createInviteToken } from "@/lib/jwt";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { getOrganizationIdFromInviteId } from "@/lib/utils/helper";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import {
  deleteMembership,
  getMembershipsByUserId,
} from "@/modules/organization/settings/teams/lib/membership";
import { refreshInviteExpiration } from "./lib/invite";

const ZCreateInviteTokenAction = z.object({
  inviteId: ZUuid,
});

export const createInviteTokenAction = authenticatedActionClient.inputSchema(ZCreateInviteTokenAction).action(
  withAuditLogging("updated", "invite", async ({ parsedInput, ctx }) => {
    const organizationId = await getOrganizationIdFromInviteId(parsedInput.inviteId);

    await assertCan({ type: "user", id: ctx.user.id }, "organization.manage", {
      type: "organization",
      id: organizationId,
    });
    await applyRateLimit(rateLimitConfigs.actions.stateMutation, organizationId);

    // Get old expiresAt for audit logging before update
    const oldInvite = await prisma.invite.findUnique({
      where: { id: parsedInput.inviteId },
      select: { email: true, expiresAt: true },
    });

    if (!oldInvite) {
      throw new ValidationError("Invite not found");
    }

    // Refresh the invitation expiration
    const updatedInvite = await refreshInviteExpiration(parsedInput.inviteId);

    // Set audit context
    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.inviteId = parsedInput.inviteId;
    ctx.auditLoggingCtx.oldObject = { expiresAt: oldInvite.expiresAt };
    ctx.auditLoggingCtx.newObject = { expiresAt: updatedInvite.expiresAt };

    const inviteToken = createInviteToken(parsedInput.inviteId, updatedInvite.email, {
      expiresIn: "7d",
    });

    return { inviteToken: encodeURIComponent(inviteToken) };
  })
);

const ZLeaveOrganizationAction = z.object({
  organizationId: ZId,
});

export const leaveOrganizationAction = authenticatedActionClient.inputSchema(ZLeaveOrganizationAction).action(
  withAuditLogging("deleted", "membership", async ({ ctx, parsedInput }) => {
    await assertCan({ type: "user", id: ctx.user.id }, "organization.read", {
      type: "organization",
      id: parsedInput.organizationId,
    });
    await applyRateLimit(rateLimitConfigs.actions.stateMutation, parsedInput.organizationId);

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
  })
);
