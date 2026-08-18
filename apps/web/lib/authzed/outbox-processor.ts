import "server-only";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { reconcileApiKeyRelationships } from "./api-key";
import { isAuthzedEnabled } from "./config";
import { reconcileFeedbackDirectoryRelationships } from "./feedback-directory";
import {
  recordAuthzedOutboxDelivery,
  recordAuthzedOutboxStatus,
  recordAuthzedRevocationDelivery,
} from "./metrics";
import {
  deleteOrganizationRelationships,
  deleteUserOrganizationRelationships,
  reconcileOrganizationMemberships,
} from "./organization-membership";
import {
  AUTHZED_OUTBOX_BATCH_SIZE,
  claimAuthzedOutboxEvents,
  createAuthzedOutboxLeaseOwner,
  getAuthzedOutboxStatus,
  markAuthzedOutboxEventsDelivered,
  markAuthzedOutboxEventsFailed,
} from "./outbox-repository";
import type {
  TAuthzedOutboxDrainResult,
  TAuthzedOutboxEvent,
  TAuthzedOutboxTargetType,
} from "./outbox-types";
import type { TAuthzedProjectionResult } from "./projection";
import { deleteUserTeamRelationships, reconcileTeamWorkspaceRelationships } from "./team-workspace";

const DELIVERY_ERROR_CODE = "authzed_projection_delivery_failed";
const DISABLED_ERROR_CODE = "authzed_disabled";

type TGroupedEvents = ReadonlyMap<TAuthzedOutboxTargetType, ReadonlyArray<TAuthzedOutboxEvent>>;

const groupEvents = (events: ReadonlyArray<TAuthzedOutboxEvent>): TGroupedEvents => {
  const grouped = new Map<TAuthzedOutboxTargetType, TAuthzedOutboxEvent[]>();
  for (const event of events) {
    const targetEvents = grouped.get(event.targetType) ?? [];
    targetEvents.push(event);
    grouped.set(event.targetType, targetEvents);
  }
  return grouped;
};

const requireProjected = (result: TAuthzedProjectionResult): void => {
  if (result.status === "projected") return;
  throw new Error(result.status === "disabled" ? DISABLED_ERROR_CODE : result.code);
};

const secondaryTargets = (
  events: ReadonlyArray<TAuthzedOutboxEvent> | undefined
): ReadonlyArray<Readonly<{ primaryId: string; secondaryId: string }>> =>
  (events ?? []).flatMap((event) =>
    event.secondaryId ? [{ primaryId: event.primaryId, secondaryId: event.secondaryId }] : []
  );

const reconcileUser = async (userId: string): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isActive: true,
      memberships: { select: { organizationId: true } },
      teamUsers: { select: { teamId: true } },
    },
  });

  if (!user?.isActive) {
    requireProjected(await deleteUserOrganizationRelationships(userId));
    requireProjected(await deleteUserTeamRelationships(userId));
    return;
  }

  requireProjected(
    await reconcileOrganizationMemberships({
      memberships: user.memberships.map(({ organizationId }) => ({ organizationId, userId })),
    })
  );
  requireProjected(
    await reconcileTeamWorkspaceRelationships({
      teamMemberships: user.teamUsers.map(({ teamId }) => ({ teamId, userId })),
    })
  );
};

const reconcileEventGroups = async (grouped: TGroupedEvents): Promise<void> => {
  const membershipTargets = secondaryTargets(grouped.get("membership"));
  requireProjected(
    await reconcileOrganizationMemberships({
      memberships: membershipTargets.map(({ primaryId, secondaryId }) => ({
        organizationId: primaryId,
        userId: secondaryId,
      })),
    })
  );

  const organizations = grouped.get("organization") ?? [];
  if (organizations.length > 0) {
    const existing = new Set(
      (
        await prisma.organization.findMany({
          where: { id: { in: organizations.map(({ primaryId }) => primaryId) } },
          select: { id: true },
        })
      ).map(({ id }) => id)
    );
    for (const event of organizations) {
      if (!existing.has(event.primaryId))
        requireProjected(await deleteOrganizationRelationships(event.primaryId));
    }
  }

  for (const event of grouped.get("user") ?? []) await reconcileUser(event.primaryId);

  const teamMemberships = secondaryTargets(grouped.get("team_membership"));
  const workspaceTeamGrants = secondaryTargets(grouped.get("workspace_team"));
  requireProjected(
    await reconcileTeamWorkspaceRelationships({
      teamIds: (grouped.get("team") ?? []).map(({ primaryId }) => primaryId),
      teamMemberships: teamMemberships.map(({ primaryId, secondaryId }) => ({
        teamId: primaryId,
        userId: secondaryId,
      })),
      workspaceIds: (grouped.get("workspace") ?? []).map(({ primaryId }) => primaryId),
      workspaceTeamGrants: workspaceTeamGrants.map(({ primaryId, secondaryId }) => ({
        teamId: secondaryId,
        workspaceId: primaryId,
      })),
    })
  );

  const apiKeyWorkspaceGrants = secondaryTargets(grouped.get("api_key_workspace"));
  requireProjected(
    await reconcileApiKeyRelationships({
      apiKeyIds: (grouped.get("api_key") ?? []).map(({ primaryId }) => primaryId),
      apiKeyWorkspaceGrants: apiKeyWorkspaceGrants.map(({ primaryId, secondaryId }) => ({
        apiKeyId: primaryId,
        workspaceId: secondaryId,
      })),
    })
  );

  const assignments = secondaryTargets(grouped.get("feedback_directory_assignment"));
  requireProjected(
    await reconcileFeedbackDirectoryRelationships({
      assignments: assignments.map(({ primaryId, secondaryId }) => ({
        feedbackDirectoryId: primaryId,
        workspaceId: secondaryId,
      })),
      feedbackDirectoryIds: (grouped.get("feedback_directory") ?? []).map(({ primaryId }) => primaryId),
    })
  );
};

const sanitizeDeliveryError = (error: unknown): string => {
  if (error instanceof Error) {
    if (error.message === DISABLED_ERROR_CODE) return DISABLED_ERROR_CODE;
    if (error.message.startsWith("authzed_")) return error.message;
  }
  return DELIVERY_ERROR_CODE;
};

export const processAuthzedOutboxBatch = async (
  leaseOwner = createAuthzedOutboxLeaseOwner(),
  batchSize = AUTHZED_OUTBOX_BATCH_SIZE
): Promise<Readonly<{ claimed: number; deadLettered: number; delivered: number; failed: number }>> => {
  const events = await claimAuthzedOutboxEvents(leaseOwner, batchSize);
  if (events.length === 0) return { claimed: 0, deadLettered: 0, delivered: 0, failed: 0 };

  const startedAt = performance.now();
  try {
    await reconcileEventGroups(groupEvents(events));
    await markAuthzedOutboxEventsDelivered(
      leaseOwner,
      events.map(({ id }) => id)
    );
    const deliveredAt = Date.now();
    for (const event of events) {
      if (event.isRevocation) {
        recordAuthzedRevocationDelivery(deliveredAt - event.createdAt.getTime());
      }
    }
    recordAuthzedOutboxDelivery({
      count: events.length,
      durationMs: performance.now() - startedAt,
      status: "delivered",
    });
    return { claimed: events.length, deadLettered: 0, delivered: events.length, failed: 0 };
  } catch (error) {
    const errorCode = sanitizeDeliveryError(error);
    const deadLettered = await markAuthzedOutboxEventsFailed(leaseOwner, events, errorCode);
    logger.warn(
      {
        component: "authzed",
        count: events.length,
        deadLettered,
        errorCode,
        operation: "projection_outbox_delivery",
        status: "failed",
      },
      "AuthZed projection outbox delivery failed"
    );
    recordAuthzedOutboxDelivery({
      count: events.length,
      durationMs: performance.now() - startedAt,
      status: "failed",
    });
    return { claimed: events.length, deadLettered, delivered: 0, failed: events.length };
  }
};

export const drainAuthzedOutbox = async (maxBatches = 100): Promise<TAuthzedOutboxDrainResult> => {
  const totals = { claimed: 0, deadLettered: 0, delivered: 0, failed: 0 };
  const leaseOwner = createAuthzedOutboxLeaseOwner();

  for (let batch = 0; batch < maxBatches; batch++) {
    const result = await processAuthzedOutboxBatch(leaseOwner);
    totals.claimed += result.claimed;
    totals.deadLettered += result.deadLettered;
    totals.delivered += result.delivered;
    totals.failed += result.failed;
    if (result.claimed === 0 || result.failed > 0) break;
  }

  const status = await getAuthzedOutboxStatus();
  recordAuthzedOutboxStatus(status);
  return { ...totals, remaining: status.pending, status: status.pending === 0 ? "drained" : "partial" };
};

export const processAuthzedProjectionDeliveryJob = async (): Promise<void> => {
  if (!isAuthzedEnabled()) return;
  await drainAuthzedOutbox(10);
};
