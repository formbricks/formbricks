"use server";

import { z } from "zod";
import { ZId, ZUuid } from "@formbricks/types/common";
import { AuthenticationError, ValidationError } from "@formbricks/types/errors";
import { ZMembershipUpdateInput } from "@formbricks/types/memberships";
import { assertCan } from "@/lib/authorization";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { assertUserManagementAllowed } from "@/lib/membership/user-management";
import { lockUserActiveState } from "@/lib/user/reactivation";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { getOrganizationIdFromInviteId } from "@/lib/utils/helper";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { updateInvite } from "@/modules/ee/role-management/lib/invite";
import { updateMembership } from "@/modules/ee/role-management/lib/membership";
import {
  assertCanAssignRole,
  checkRoleManagementPermission,
} from "@/modules/ee/role-management/lib/permission";
import { ZInviteUpdateInput } from "@/modules/ee/role-management/types/invites";
import { getInvite } from "@/modules/organization/settings/teams/lib/invite";
import {
  LastActiveOwnerError,
  runOwnerGuardedTransaction,
} from "@/modules/organization/settings/teams/lib/owner-guard";

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

    await assertCanAssignRole({
      organizationId,
      assignerRole: currentUserMembership.role,
      roles: [parsedInput.data.role],
    });
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

const demoteOwner = async (
  organizationId: string,
  userId: string,
  data: z.infer<typeof ZMembershipUpdateInput>
) => {
  try {
    return await runOwnerGuardedTransaction(organizationId, userId, async (tx) => {
      // The user's row, as removing a member takes it: a demotion to Dashboard viewer decides whether only
      // viewer memberships remain (and revokes the wider OAuth grants), and must see a removal from another
      // organization that commits at the same moment.
      await lockUserActiveState(tx, userId);
      return updateMembership(userId, organizationId, data, tx);
    });
  } catch (error) {
    if (error instanceof LastActiveOwnerError) {
      throw new ValidationError("You cannot demote the last owner of the organization");
    }
    throw error;
  }
};

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

    const targetMembership = await getMembershipByUserIdOrganizationId(
      parsedInput.userId,
      parsedInput.organizationId
    );
    await assertCanAssignRole({
      organizationId: parsedInput.organizationId,
      assignerRole: currentUserMembership.role,
      roles: [parsedInput.data.role],
      targetCurrentRole: targetMembership?.role,
    });
    await checkRoleManagementPermission(parsedInput.organizationId);

    ctx.auditLoggingCtx.organizationId = parsedInput.organizationId;
    ctx.auditLoggingCtx.membershipId = `${parsedInput.userId}-${parsedInput.organizationId}`;
    ctx.auditLoggingCtx.oldObject = targetMembership;

    const isDemotingOwner = targetMembership?.role === "owner" && parsedInput.data.role !== "owner";

    // The owner count and the role update must be one atomic unit: read then act, in two separate
    // statements, lets two owners demoting each other concurrently both read "more than one owner"
    // and both writes land, leaving zero owners. The owners' lock (`runOwnerGuardedTransaction`, the
    // one every last-owner check takes) makes the second wait, then count what the first committed.
    // Only a demotion of an owner runs in a transaction, as before; deciding it under the lock instead
    // of from the lookup above is ENG-2177.
    const result = isDemotingOwner
      ? await demoteOwner(parsedInput.organizationId, parsedInput.userId, parsedInput.data)
      : await updateMembership(parsedInput.userId, parsedInput.organizationId, parsedInput.data);

    ctx.auditLoggingCtx.newObject = result;
    return result;
  })
);
