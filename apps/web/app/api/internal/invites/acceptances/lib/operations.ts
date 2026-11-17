import "server-only";
import { after } from "next/server";
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
const acceptInviteInTransaction = (
  invite: TInvite,
  userId: string
): Promise<{ membership: TMembership; teamIds: string[] }> =>
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
    const teamIds =
      invite.teamIds.length > 0
        ? await createTeamMembership(
            { organizationId: invite.organizationId, role: invite.role, teamIds: invite.teamIds },
            userId,
            { projection: "deferred", transaction: tx }
          )
        : [];
    return { membership, teamIds };
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

/**
 * The answer to an acceptance whose transaction failed, or null for a failure to rethrow. The caller hears
 * it is already a member whenever it is: an existing membership, a second acceptance of the same invite that
 * finds it spent by the first, or another invite to the same organization that committed first (the insert
 * then fails on the unique key as a generic database error). An invite spent or expired since it was read,
 * by anyone else, answers as if it had been read that way.
 */
const refuseFailedAcceptance = async (
  error: unknown,
  userId: string,
  organizationId: string,
  requestId: string,
  instance: string | undefined
): Promise<Response | null> => {
  if (error instanceof AlreadyMemberError) return alreadyMember(requestId, instance);
  if (await isMemberOf(userId, organizationId)) return alreadyMember(requestId, instance);
  if (error instanceof InviteNoLongerValidError) return problemForbidden(requestId, undefined, instance);
  return null;
};

type TInviteUser = NonNullable<Awaited<ReturnType<typeof getUser>>>;

/**
 * SpiceDB follows PostgreSQL only after the commit, as for every other membership write. Awaited: the page
 * the acceptance redirects to needs the new access. Only the teams the transaction wrote are reconciled.
 */
const projectAcceptance = async (organizationId: string, userId: string, teamIds: string[]) => {
  await reconcileOrganizationMembership(organizationId, userId);
  if (teamIds.length > 0) {
    await runPostCommitProjection("invite_team_membership_create", () =>
      reconcileTeamWorkspaceRelationships({ teamMemberships: teamIds.map((teamId) => ({ teamId, userId })) })
    );
  }
};

/**
 * The notices that follow a committed acceptance, run after the response as the page's acceptance did, so a
 * slow SMTP server never holds the Accept button. Each is best-effort: the membership already exists.
 */
const notifyAcceptance = async (invite: TInvite, user: TInviteUser): Promise<void> => {
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
    // Re-read: this runs after the response, behind the email, so the settings read before the acceptance
    // may be stale, and writing them back would undo a change made in between.
    const current = (await getUser(user.id)) ?? user;
    await updateUser(user.id, {
      notificationSettings: {
        ...current.notificationSettings,
        alert: current.notificationSettings.alert ?? {},
        unsubscribedOrganizationIds: Array.from(
          new Set([
            ...(current.notificationSettings?.unsubscribedOrganizationIds || []),
            invite.organizationId,
          ])
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

  let accepted: { membership: TMembership; teamIds: string[] };
  try {
    accepted = await acceptInviteInTransaction(invite, user.id);
  } catch (error) {
    const refusal = await refuseFailedAcceptance(error, user.id, invite.organizationId, requestId, instance);
    if (refusal) return refusal;
    throw error;
  }

  const { membership, teamIds } = accepted;
  if (auditLog) auditLog.newObject = { ...membership, teamIds };

  await projectAcceptance(invite.organizationId, user.id, teamIds);
  after(() => notifyAcceptance(invite, user));

  return successResponse(serializeInviteAcceptance(membership), { requestId, status: 201 });
}
