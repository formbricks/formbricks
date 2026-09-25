import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { reconcileOrganizationMembership } from "@/lib/authzed/organization-membership";
import { runPostCommitProjection } from "@/lib/authzed/projection-boundary";
import { reconcileTeamWorkspaceRelationships } from "@/lib/authzed/team-workspace";
import { verifyInviteToken } from "@/lib/jwt";
import { getUser } from "@/lib/user/service";
import { emitSecurityAudit } from "@/modules/auth/lib/security-audit";
import { getSession } from "@/modules/auth/lib/session";
import { sendInviteAcceptedEmail } from "@/modules/email";

type AcceptanceStatus = "accepted" | "not_found" | "expired" | "sign_in_required" | "email_mismatch";

/** The server session is the actor. Consume the invite and write its complete grant set atomically,
 * then emit once for the committed result. A replay cannot reapply an old invitation's permissions.
 */
export const acceptInvitation = async (
  token: string
): Promise<{ status: AcceptanceStatus; email?: string }> => {
  const requestId = randomUUID();
  let actorId: string | undefined;
  let inviteId = "unknown";
  let organizationId: string | undefined;
  let committed = false;
  try {
    const session = await getSession();
    actorId = session?.user.id;
    const verified = verifyInviteToken(token);
    inviteId = verified.inviteId;
    const user = actorId ? await getUser(actorId) : null;
    const result = await prisma.$transaction(async (tx) => {
      const invite = await tx.invite.findUnique({
        where: { id: inviteId },
        include: { creator: { select: { name: true, email: true, locale: true } } },
      });
      if (!invite) return { status: "not_found" as const };
      organizationId = invite.organizationId;
      if (invite.expiresAt <= new Date()) return { status: "expired" as const };
      if (!user) return { status: "sign_in_required" as const };
      if (
        user.email.toLowerCase() !== verified.email.toLowerCase() ||
        user.email.toLowerCase() !== invite.email.toLowerCase()
      ) {
        return { status: "email_mismatch" as const };
      }
      // A concurrent acceptance loses this delete and rolls its transaction back before grants change.
      await tx.invite.delete({ where: { id: invite.id } });
      const before = await tx.membership.findUnique({
        where: { userId_organizationId: { userId: user.id, organizationId: invite.organizationId } },
      });
      await tx.membership.upsert({
        where: { userId_organizationId: { userId: user.id, organizationId: invite.organizationId } },
        create: { userId: user.id, organizationId: invite.organizationId, accepted: true, role: invite.role },
        update: { accepted: true, role: invite.role },
      });
      const teams = await tx.team.findMany({
        where: { id: { in: invite.teamIds }, organizationId: invite.organizationId },
        select: { id: true },
      });
      const teamRole =
        invite.role === "owner" || invite.role === "manager" ? ("admin" as const) : ("contributor" as const);
      const teamChanges = [];
      for (const team of teams) {
        const old = await tx.teamUser.findUnique({
          where: { teamId_userId: { teamId: team.id, userId: user.id } },
        });
        await tx.teamUser.upsert({
          where: { teamId_userId: { teamId: team.id, userId: user.id } },
          create: { teamId: team.id, userId: user.id, role: teamRole },
          update: { role: teamRole },
        });
        teamChanges.push({
          id: `${team.id}:${user.id}`,
          teamId: team.id,
          beforeRole: old?.role ?? null,
          afterRole: teamRole,
        });
      }
      await tx.user.update({
        where: { id: user.id },
        data: {
          notificationSettings: {
            ...user.notificationSettings,
            alert: user.notificationSettings.alert ?? {},
            unsubscribedOrganizationIds: Array.from(
              new Set([
                ...(user.notificationSettings.unsubscribedOrganizationIds ?? []),
                invite.organizationId,
              ])
            ),
          },
        },
      });
      return {
        status: "accepted" as const,
        invite,
        teams,
        teamChanges,
        beforeRole: before?.role ?? null,
        beforeAccepted: before?.accepted ?? null,
      };
    });
    committed = result.status === "accepted";
    await emitSecurityAudit({
      operation: "invitation_acceptance",
      actor: actorId ? { id: actorId, type: "user" } : undefined,
      target: { type: "invite", id: inviteId },
      organizationId,
      scope: organizationId ? "organization" : "unknown",
      status:
        result.status === "accepted"
          ? result.teams.length === new Set(result.invite.teamIds).size
            ? "success"
            : "partial"
          : "denied",
      source: "invite-page",
      requestId,
      changes:
        result.status === "accepted"
          ? {
              inviteConsumed: true,
              membership: {
                id: `${actorId}:${organizationId}`,
                beforeRole: result.beforeRole,
                beforeAccepted: result.beforeAccepted,
                afterRole: result.invite.role,
                accepted: true,
              },
              teamMemberships: result.teamChanges,
              skippedTeamIds: result.invite.teamIds.filter(
                (id) => !result.teams.some((team) => team.id === id)
              ),
              notificationSettingsUpdated: !user?.notificationSettings.unsubscribedOrganizationIds?.includes(
                result.invite.organizationId
              ),
            }
          : { reason: result.status },
    });
    if (result.status === "accepted" && user) {
      await runPostCommitProjection("invitation_acceptance", async () => {
        await reconcileOrganizationMembership(result.invite.organizationId, user.id);
        return reconcileTeamWorkspaceRelationships({
          teamMemberships: result.teams.map(({ id }) => ({ teamId: id, userId: user.id })),
        });
      });
      try {
        await sendInviteAcceptedEmail(
          result.invite.creator.name ?? "",
          user.name ?? "",
          result.invite.creator.email,
          result.invite.creator.locale
        );
      } catch {
        logger.error("Failed to send invitation-acceptance notification");
      }
    }
    return { status: result.status, email: verified.email };
  } catch (error) {
    if (!committed)
      await emitSecurityAudit({
        operation: "invitation_acceptance",
        actor: actorId ? { id: actorId, type: "user" } : undefined,
        target: { type: "invite", id: inviteId },
        organizationId,
        scope: organizationId ? "organization" : "unknown",
        status: inviteId === "unknown" ? "denied" : "failure",
        source: "invite-page",
        requestId,
      });
    throw error;
  }
};
