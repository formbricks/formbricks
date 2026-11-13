import "server-only";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import type { TMembership } from "@formbricks/types/memberships";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import {
  problemConflict,
  problemForbidden,
  problemUnauthorized,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { reconcileOrganizationMembership } from "@/lib/authzed/organization-membership";
import { runPostCommitProjection } from "@/lib/authzed/projection-boundary";
import { reconcileTeamWorkspaceRelationships } from "@/lib/authzed/team-workspace";
import { verifyInviteToken } from "@/lib/jwt";
import { createMembership } from "@/lib/membership/service";
import { getUser, updateUser } from "@/lib/user/service";
import { getInvite } from "@/modules/auth/invite/lib/invite";
import { createTeamMembership } from "@/modules/auth/signup/lib/team";
import { sendInviteAcceptedEmail } from "@/modules/email";
import type { TInviteAcceptanceBody } from "../schemas";
import { serializeInviteAcceptance } from "../serializers";

/** `details.reason` of a refusal the invite page explains. */
export const INVITE_ACCEPTANCE_REFUSAL = {
  expired: "invite_expired",
  alreadyMember: "already_member",
} as const;

/** Thrown inside the transaction to roll it back: the invite was spent, or expired, since it was read. */
class InviteNoLongerValidError extends Error {}
/** Thrown inside the transaction to roll it back: the user already belongs to the organization. */
class AlreadyMemberError extends Error {}

type TInvite = NonNullable<Awaited<ReturnType<typeof getInvite>>>;

/**
 * The acceptance's writes, all or nothing. The invite is spent first, conditioned on still existing and not
 * having expired, so two acceptances of one invite cannot both get past it: the second waits on the first's
 * row lock and then finds nothing to delete. An existing membership refuses the whole acceptance, so an
 * invite never overwrites a role someone already holds (ENG-7097).
 */
const acceptInviteInTransaction = (invite: TInvite, userId: string): Promise<TMembership> =>
  prisma.$transaction(async (tx) => {
    const spent = await tx.invite.deleteMany({
      where: { id: invite.id, organizationId: invite.organizationId, expiresAt: { gt: new Date() } },
    });
    if (spent.count === 0) throw new InviteNoLongerValidError();

    const existing = await tx.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId: invite.organizationId } },
      select: { userId: true },
    });
    if (existing) throw new AlreadyMemberError();

    const membership = await createMembership(
      invite.organizationId,
      userId,
      { accepted: true, role: invite.role },
      { projection: "deferred", transaction: tx }
    );
    if (invite.teamIds.length > 0) {
      await createTeamMembership(
        { organizationId: invite.organizationId, role: invite.role, teamIds: invite.teamIds },
        userId,
        { projection: "deferred", transaction: tx }
      );
    }
    return membership;
  });

const alreadyMember = (requestId: string, instance?: string) =>
  problemConflict(requestId, "You are already a member of this organization.", instance, {
    details: { reason: INVITE_ACCEPTANCE_REFUSAL.alreadyMember },
  });

const isMemberOf = async (userId: string, organizationId: string): Promise<boolean> =>
  (await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { userId: true },
  })) !== null;

type TInviteUser = NonNullable<Awaited<ReturnType<typeof getUser>>>;

/** What follows a committed acceptance. Each step is best-effort: the membership already exists. */
const afterAcceptance = async (invite: TInvite, user: TInviteUser): Promise<void> => {
  // SpiceDB follows PostgreSQL only after the commit, as for every other membership write.
  await reconcileOrganizationMembership(invite.organizationId, user.id);
  if (invite.teamIds.length > 0) {
    await runPostCommitProjection("invite_team_membership_create", () =>
      reconcileTeamWorkspaceRelationships({
        teamMemberships: invite.teamIds.map((teamId) => ({ teamId, userId: user.id })),
      })
    );
  }

  try {
    await sendInviteAcceptedEmail(
      invite.creator.name ?? "",
      user.name ?? "",
      invite.creator.email,
      invite.creator.locale,
      user.id,
      invite.organizationId
    );
  } catch (error) {
    logger.error({ err: error }, "Failed to send invite accepted email");
  }

  try {
    await updateUser(user.id, {
      notificationSettings: {
        ...user.notificationSettings,
        alert: user.notificationSettings.alert ?? {},
        unsubscribedOrganizationIds: Array.from(
          new Set([...(user.notificationSettings?.unsubscribedOrganizationIds || []), invite.organizationId])
        ),
      },
    });
  } catch (error) {
    logger.error({ err: error, userId: user.id }, "Failed to update notification settings after invite");
  }
};

/** The token's invite, or null when the token does not verify. */
const readInviteToken = (token: string): { inviteId: string; email: string } | null => {
  try {
    return verifyInviteToken(token);
  } catch {
    // `verifyInviteToken` logs the failure itself.
    return null;
  }
};

/**
 * `POST /api/internal/invites/acceptances`: accept the invite behind `token` as the signed-in user. Everything
 * the invite page checked is checked again here, since the page's answer is only as fresh as its render: the
 * token's signature, the invite, its expiry, and that the token was sent to this user's address. A token that
 * does not verify, a missing invite and a different user's invite all answer the uniform 403; an expired one
 * 422 (`invite_expired`); and one for an organization the user already belongs to 409 (`already_member`),
 * changing nothing. 201 with the new membership otherwise.
 */
export async function acceptInviteOperation({
  authentication,
  body,
  requestId,
  instance,
  auditLog,
}: {
  authentication: TV3Authentication;
  body: TInviteAcceptanceBody;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
}): Promise<Response> {
  const actor = getV3AuthorizationActor(authentication);
  if (actor?.type !== "user") return problemUnauthorized(requestId, "Session required", instance);

  const tokenData = readInviteToken(body.token);
  if (!tokenData) return problemForbidden(requestId, undefined, instance);

  const [invite, user] = await Promise.all([getInvite(tokenData.inviteId), getUser(actor.id)]);
  if (!invite || user?.email.toLowerCase() !== tokenData.email.toLowerCase()) {
    return problemForbidden(requestId, undefined, instance);
  }

  if (auditLog) {
    auditLog.organizationId = invite.organizationId;
    auditLog.targetId = `${user.id}-${invite.organizationId}`;
  }

  if (new Date(invite.expiresAt) < new Date()) {
    return problemUnprocessableContent(requestId, "This invite has expired.", {
      instance,
      details: { reason: INVITE_ACCEPTANCE_REFUSAL.expired },
    });
  }

  let membership: TMembership;
  try {
    membership = await acceptInviteInTransaction(invite, user.id);
  } catch (error) {
    if (error instanceof AlreadyMemberError) return alreadyMember(requestId, instance);
    // Spent or expired between the read above and the transaction: the same answers as if read that way.
    if (error instanceof InviteNoLongerValidError) return problemForbidden(requestId, undefined, instance);
    // A concurrent acceptance of another invite to the same organization committed the membership first:
    // the insert then fails on the unique key, which reaches here as a generic database error.
    if (await isMemberOf(user.id, invite.organizationId)) return alreadyMember(requestId, instance);
    throw error;
  }

  if (auditLog) auditLog.newObject = { ...membership, teamIds: invite.teamIds };

  await afterAcceptance(invite, user);

  return successResponse(serializeInviteAcceptance(membership), { requestId, status: 201 });
}
