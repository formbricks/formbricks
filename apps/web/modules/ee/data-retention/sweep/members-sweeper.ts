import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { ZUserLocale } from "@formbricks/types/user";
import { revokeAllUserOAuthGrants } from "@/modules/auth/lib/oauth-grant-revocation";
import { revokeUserSessionsExcept } from "@/modules/auth/lib/session-revocation";
import { queueAuditEventWithoutRequest } from "@/modules/ee/audit-logs/lib/handler";
import { sendMemberRetentionNoticeEmail } from "@/modules/email";
import { formatRetentionDate } from "../lib/display";
import {
  type TRetentionTargetState,
  getDueRetentionStep,
  getMemberRetentionClock,
  getRetentionClockCutoffs,
  getRetentionSchedule,
} from "../lib/schedule";
import { RETENTION_SWEEP_BATCH_SIZE } from "./constants";
import { collectDueTargets, loadNoticeOrganization } from "./due-targets";
import { claimRetentionNotice, markRetentionNoticeDelivered } from "./notices";
import { type TRetentionRunSkip, recordRetentionRunActions, recordRetentionRunSkips } from "./run";
import type { TRetentionSweepContext, TRetentionSweeper } from "./sweep";
import { lockUnchangedRetentionPolicy, readDatabaseClock, runSweepTransaction } from "./transaction";

/** An active member whose clock may be in the warning window, and what their schedule reads. */
type TMemberCandidate = {
  userId: string;
  email: string;
  locale: string;
  role: "owner" | "manager" | "member" | "billing";
  lastLoginAt: Date | null;
  /** When one of their sessions was last renewed: someone who stays signed in is still active. */
  lastSessionAt: Date | null;
  reactivatedAt: Date | null;
  /**
   * How many organisations they belong to or are invited to (a pending, unexpired invite counts:
   * deactivating the account would stop them accepting it). The policy only acts on someone who is in
   * this one alone.
   */
  organizationCount: number;
  noticeClaimedAt: Date | null;
  noticeDeliveredAt: Date | null;
};

const targetState = (context: TRetentionSweepContext, member: TMemberCandidate): TRetentionTargetState => ({
  clock: getMemberRetentionClock(member, context.policy, context.now),
  noticeClaimedAt: member.noticeClaimedAt,
  noticeDeliveredAt: member.noticeDeliveredAt,
  heldUntil: null,
  archivedAt: null,
});

/**
 * The organisation's active members whose clock is at or before `noticeDueAtOrBefore`: their last
 * sign-in or session renewal, or the day the policy took effect for someone who never signed in, moved
 * on by a reactivation (`getMemberRetentionClock`). Keyset-paged on the user id; `userId` narrows it to one
 * member, for the re-check under lock.
 */
const readCandidates = (
  client: Pick<Prisma.TransactionClient, "$queryRaw">,
  context: TRetentionSweepContext,
  { afterId, userId, noticeDueAtOrBefore }: { afterId?: string; userId?: string; noticeDueAtOrBefore: Date }
): Promise<TMemberCandidate[]> => client.$queryRaw<TMemberCandidate[]>`
  SELECT u."id" AS "userId", u."email", u."locale", m."role"::text AS "role",
         u."lastLoginAt", u."reactivatedAt",
         (SELECT MAX(se."updated_at") FROM "Session" se WHERE se."userId" = u."id") AS "lastSessionAt",
         (SELECT count(*)::int FROM "Membership" o WHERE o."userId" = u."id")
           + (SELECT count(*)::int FROM "Invite" i
               WHERE lower(i."email") = lower(u."email") AND i."acceptorId" IS NULL
                 AND i."expiresAt" > ${context.now} AND i."organizationId" <> m."organizationId")
           AS "organizationCount",
         n."sentAt" AS "noticeClaimedAt", n."deliveredAt" AS "noticeDeliveredAt"
  FROM "Membership" m
  JOIN "User" u ON u."id" = m."userId"
  LEFT JOIN "RetentionNotice" n
    ON n."userId" = u."id" AND n."organizationId" = m."organizationId" AND n."entity" = 'members'
  WHERE m."organizationId" = ${context.policy.organizationId}
    AND u."isActive"
    -- GREATEST skips NULLs: the latest of sign-in (or, with none, the policy's start), reactivation and
    -- session renewal, as getMemberRetentionClock computes it.
    AND GREATEST(
      COALESCE(u."lastLoginAt", ${context.policy.enabledAt}),
      u."reactivatedAt",
      (SELECT MAX(se."updated_at") FROM "Session" se WHERE se."userId" = u."id")
    ) <= ${noticeDueAtOrBefore}
    ${userId ? Prisma.sql`AND u."id" = ${userId}` : Prisma.empty}
    ${afterId ? Prisma.sql`AND u."id" > ${afterId}` : Prisma.empty}
  ORDER BY u."id"
  LIMIT ${RETENTION_SWEEP_BATCH_SIZE}
`;

type TDeactivation = "deactivated" | "lastOwner" | "otherOrganization" | null;

/**
 * Deactivate one member whose notice has run its full warning, in one transaction:
 * - lock the organisation's owner memberships, so two deactivations can't both pass the last-owner check
 *   and a demotion waits; then the user row (the same lock Reactivate takes, which also makes a new
 *   membership wait for its foreign key);
 * - hold the policy unchanged, re-read the member (still active, still in this organisation alone, the
 *   same clock) and re-check that the schedule says `act`;
 * - never the organisation's last active owner.
 * The `User.isActive` change reaches SpiceDB through the projection outbox trigger on the column.
 *
 * Locks are taken memberships first, then the user. A member deleting their own account at the same
 * moment locks in the other order (the user, then its memberships by cascade), so the two can deadlock;
 * Postgres then aborts one of them: the run's error is logged and the policy carries on next night.
 */
export const deactivateDueMember = async (
  context: TRetentionSweepContext,
  userId: string,
  noticeDueAtOrBefore: Date
): Promise<TDeactivation> =>
  runSweepTransaction(async (tx) => {
    await tx.$queryRaw`
      SELECT 1 FROM "Membership"
      WHERE "organizationId" = ${context.policy.organizationId} AND "role" = 'owner'
      ORDER BY "userId"
      FOR UPDATE
    `;
    await tx.$queryRaw`SELECT 1 FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    await lockUnchangedRetentionPolicy(tx, context.policy);
    const [member] = await readCandidates(tx, context, { userId, noticeDueAtOrBefore });
    if (!member || getDueRetentionStep(context.policy, targetState(context, member), context.now) !== "act") {
      return null;
    }
    if (member.organizationCount > 1) return "otherOrganization";
    if (member.role === "owner") {
      const otherActiveOwners = await tx.membership.count({
        where: {
          organizationId: context.policy.organizationId,
          role: "owner",
          userId: { not: userId },
          user: { isActive: true },
        },
      });
      if (otherActiveOwners === 0) return "lastOwner";
    }

    await tx.user.update({ where: { id: userId }, data: { isActive: false } });
    await recordRetentionRunActions(tx, context.runId, [
      // No name: History keeps the user id only (ENG-3614).
      { targetType: "user", targetId: userId, targetName: null, action: "deactivated" },
    ]);
    return "deactivated";
  });

/**
 * End a deactivated member's sessions and OAuth grants. Requests from an inactive user are already
 * refused (`modules/auth/lib/session.ts`, `modules/mcp/auth.ts`); this removes what they could still
 * hold. Only if they are still inactive: a Reactivate in between wins. API keys are left alone: they
 * belong to the organisation, and deleting them would break its integrations past what Reactivate can
 * undo. Best-effort: the deactivation has committed.
 */
export const revokeCredentials = async (userId: string): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isActive: true } });
    if (!user || user.isActive) return;
    await revokeUserSessionsExcept({ userId });
    await prisma.$transaction((tx) => revokeAllUserOAuthGrants(tx, userId));
  } catch (error) {
    logger.error({ error, userId }, "Revoking a deactivated member's credentials failed");
  }
};

/**
 * Send one member their notice: claim it, email them in their locale, record the delivery. When sending
 * throws, the claim stays undelivered and nothing acts on it; it is claimed again once stale.
 */
const notifyMember = async (
  context: TRetentionSweepContext,
  member: TMemberCandidate,
  organization: { name: string; timeZone: string }
): Promise<void> => {
  const target = {
    organizationId: context.policy.organizationId,
    entity: "members" as const,
    userId: member.userId,
  };
  const state = targetState(context, member);
  const claimToken = await runSweepTransaction(async (tx) => {
    await lockUnchangedRetentionPolicy(tx, context.policy);
    const claimedAt = await readDatabaseClock(tx);
    const voidBefore = state.clock > context.policy.enabledAt ? state.clock : context.policy.enabledAt;
    return claimRetentionNotice(tx, target, { claimedAt, voidBefore });
  });
  if (!claimToken) return;

  // The date the email states: the schedule as it reads once this notice is delivered now.
  const { actionAt } = getRetentionSchedule(
    context.policy,
    { ...state, noticeClaimedAt: null, noticeDeliveredAt: null },
    context.now
  );
  const locale = ZUserLocale.catch("en-US").parse(member.locale);
  let emailSent: boolean;
  try {
    emailSent = await sendMemberRetentionNoticeEmail({
      email: member.email,
      locale,
      organizationName: organization.name,
      deactivateDate: formatRetentionDate(actionAt.toISOString(), locale, organization.timeZone),
    });
  } catch (error) {
    logger.error({ error, runId: context.runId, userId: member.userId }, "Member retention notice failed");
    return;
  }

  await runSweepTransaction(async (tx) => {
    const deliveredAt = await readDatabaseClock(tx);
    if (await markRetentionNoticeDelivered(tx, target, { claimToken, deliveredAt, emailSent })) {
      await recordRetentionRunActions(tx, context.runId, [
        {
          targetType: "user",
          targetId: member.userId,
          targetName: null,
          action: "notified",
          recipient: emailSent ? member.email : null,
        },
      ]);
    }
  });
};

/** After a committed deactivation: end the member's access, and audit it as a system change. */
const afterDeactivation = async (context: TRetentionSweepContext, userId: string): Promise<void> => {
  await revokeCredentials(userId);
  try {
    await queueAuditEventWithoutRequest({
      action: "deactivated",
      targetType: "user",
      targetId: userId,
      organizationId: context.policy.organizationId,
      userId: "system",
      userType: "system",
      status: "success",
      newObject: { isActive: false, retentionRunId: context.runId },
    });
  } catch (error) {
    logger.error({ error, userId }, "Data retention deactivation audit failed");
  }
};

/**
 * The members policy (ENG-3612): a member who hasn't signed in for `periodDays` is deactivated. They are
 * told themselves `warnDays` before, and signing in (or being reactivated) moves their clock and voids the
 * notice. Someone who belongs to other organisations too is never deactivated by this one
 * (`otherOrganization`), nor is the organisation's last active owner (`lastOwner`).
 */
export const createMembersSweeper = (): TRetentionSweeper => async (context) => {
  const cutoffs = getRetentionClockCutoffs(context.policy, context.now);
  const skips: TRetentionRunSkip[] = [];
  // The last active owner is never deactivated, so they aren't told they will be.
  const activeOwners = await runSweepTransaction((tx) =>
    tx.membership.count({
      where: { organizationId: context.policy.organizationId, role: "owner", user: { isActive: true } },
    })
  );
  const { notify, act } = await collectDueTargets(context, {
    readPage: (tx, afterId) =>
      readCandidates(tx, context, { afterId, noticeDueAtOrBefore: cutoffs.noticeDueAtOrBefore }),
    keyOf: (member) => member.userId,
    stepOf: (member) => {
      // Someone in other organisations is never acted on from here, so they aren't warned either.
      if (member.organizationCount > 1) {
        skips.push({ targetType: "user", targetId: member.userId, skipReason: "otherOrganization" });
        return null;
      }
      const step = getDueRetentionStep(context.policy, targetState(context, member), context.now);
      if (step === "notify" && member.role === "owner" && activeOwners <= 1) {
        skips.push({ targetType: "user", targetId: member.userId, skipReason: "lastOwner" });
        return null;
      }
      return step;
    },
  });

  return {
    act: async (deadline) => {
      const organization = await loadNoticeOrganization(context.policy.organizationId);
      for (const member of notify) {
        if (Date.now() >= deadline) break;
        await notifyMember(context, member, organization);
      }

      for (const member of act) {
        if (Date.now() >= deadline) break;
        const outcome = await deactivateDueMember(context, member.userId, cutoffs.noticeDueAtOrBefore);
        if (outcome === "lastOwner" || outcome === "otherOrganization") {
          skips.push({ targetType: "user", targetId: member.userId, skipReason: outcome });
        }
        if (outcome === "deactivated") await afterDeactivation(context, member.userId);
      }

      await recordRetentionRunSkips(context, skips);
    },
  };
};
