import "server-only";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { reconcileApiKeyRelationships } from "./api-key";
import { isAuthzedEnabled } from "./config";
import { AUTHZED_MAX_PARALLEL_RELATIONSHIP_DELETES } from "./constants";
import { AUTHZED_ERROR_CODES } from "./errors";
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
import { runChunked } from "./projection-chunks";
import { deleteUserTeamRelationships, reconcileTeamWorkspaceRelationships } from "./team-workspace";

const DELIVERY_ERROR_CODE = "authzed_projection_delivery_failed";
const DISABLED_ERROR_CODE = "authzed_disabled";
const UNSTABLE_ERROR_CODE = "authzed_projection_unstable";

/**
 * Error codes that can plausibly be caused by one event rather than by the batch it travelled in.
 *
 * Only these justify splitting a failed group to find the culprit. Every other non-retryable code —
 * `authzed_unauthenticated`, `authzed_internal` — describes the instance, not an event, so splitting
 * would spend 2xN gRPC calls every five seconds to learn what a single call already reported.
 */
const PER_EVENT_ERROR_CODES: ReadonlySet<string> = new Set<string>([
  "authzed_projection_invalid_source",
  AUTHZED_ERROR_CODES.INVALID_REQUEST,
]);

/** 2^8 exceeds the claim batch size, so a split always reaches singletons before this bites. */
const MAX_QUARANTINE_DEPTH = 8;

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

const byType = (
  events: ReadonlyArray<TAuthzedOutboxEvent>,
  targetType: TAuthzedOutboxTargetType
): ReadonlyArray<TAuthzedOutboxEvent> => events.filter((event) => event.targetType === targetType);

const secondaryTargets = (
  events: ReadonlyArray<TAuthzedOutboxEvent>
): ReadonlyArray<Readonly<{ primaryId: string; secondaryId: string }>> =>
  events.flatMap((event) =>
    event.secondaryId ? [{ primaryId: event.primaryId, secondaryId: event.secondaryId }] : []
  );

const PROJECTED_WITHOUT_WORK: TAuthzedProjectionResult = { passes: 0, status: "projected" };

/**
 * Hand targets to a reconciler in bounded chunks.
 *
 * A claimed batch is bounded, but the targets it expands into are not — one `user` event can carry an
 * unbounded number of memberships, and every list becomes its own `OR` clause in the reconciler's
 * snapshot query. `runChunked` returns `null` when every list was empty, which here means the group
 * had nothing to project rather than that it failed.
 */
const runChunkedProjection = async <TTargets extends Readonly<Record<string, ReadonlyArray<unknown>>>>(
  reconcile: (targets: TTargets) => Promise<TAuthzedProjectionResult>,
  targets: TTargets
): Promise<TAuthzedProjectionResult> => (await runChunked(reconcile, targets)) ?? PROJECTED_WITHOUT_WORK;

/**
 * Run per-subject projections with a bounded fan-out, stopping at the first that does not project.
 *
 * Used only for deletes, which address a whole subject through a relationship filter and so cannot be
 * packed into a shared write the way reconciler updates are. `runBestEffortProjection` never throws,
 * so `Promise.all` cannot reject here.
 */
const runBoundedConcurrently = async (
  operations: ReadonlyArray<() => Promise<TAuthzedProjectionResult>>
): Promise<TAuthzedProjectionResult> => {
  for (let start = 0; start < operations.length; start += AUTHZED_MAX_PARALLEL_RELATIONSHIP_DELETES) {
    const results = await Promise.all(
      operations.slice(start, start + AUTHZED_MAX_PARALLEL_RELATIONSHIP_DELETES).map((run) => run())
    );
    const failure = results.find((result) => result.status !== "projected");
    if (failure) return failure;
  }
  return PROJECTED_WITHOUT_WORK;
};

/**
 * Reconcile every named user in one pass.
 *
 * One `findMany` for the whole group rather than a `findUnique` per event: the delivery job runs on a
 * five-second cadence, and a claimed batch can carry two hundred user events. A user missing from the
 * result is treated exactly as an inactive one — `findMany` omits rows that a per-id `findUnique`
 * would have returned as `null`, and both mean there is no active user left to hold relationships.
 */
const reconcileUsers = async (
  events: ReadonlyArray<TAuthzedOutboxEvent>
): Promise<TAuthzedProjectionResult> => {
  const userIds = [...new Set(events.map(({ primaryId }) => primaryId))];
  if (userIds.length === 0) return PROJECTED_WITHOUT_WORK;

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      isActive: true,
      memberships: { select: { organizationId: true } },
      teamUsers: { select: { teamId: true } },
    },
  });

  const active = users.filter(({ isActive }) => isActive);
  const activeIds = new Set(active.map(({ id }) => id));

  const removal = await runBoundedConcurrently(
    userIds
      .filter((userId) => !activeIds.has(userId))
      .flatMap((userId) => [
        () => deleteUserOrganizationRelationships(userId),
        () => deleteUserTeamRelationships(userId),
      ])
  );
  if (removal.status !== "projected") return removal;

  const memberships = await runChunkedProjection(reconcileOrganizationMemberships, {
    memberships: active.flatMap((user) =>
      user.memberships.map(({ organizationId }) => ({ organizationId, userId: user.id }))
    ),
  });
  if (memberships.status !== "projected") return memberships;

  return runChunkedProjection(reconcileTeamWorkspaceRelationships, {
    teamMemberships: active.flatMap((user) =>
      user.teamUsers.map(({ teamId }) => ({ teamId, userId: user.id }))
    ),
  });
};

/** Organization events are inserts and deletes only; a row that is gone must lose its relationships. */
const reconcileOrganizations = async (
  events: ReadonlyArray<TAuthzedOutboxEvent>
): Promise<TAuthzedProjectionResult> => {
  const organizationIds = [...new Set(events.map(({ primaryId }) => primaryId))];
  if (organizationIds.length === 0) return PROJECTED_WITHOUT_WORK;

  const existing = new Set(
    (
      await prisma.organization.findMany({
        where: { id: { in: organizationIds } },
        select: { id: true },
      })
    ).map(({ id }) => id)
  );

  return runBoundedConcurrently(
    organizationIds
      .filter((organizationId) => !existing.has(organizationId))
      .map((organizationId) => () => deleteOrganizationRelationships(organizationId))
  );
};

/**
 * One delivery group per reconciler call.
 *
 * The grouping is the attribution boundary: a failure is charged to the events that were in flight
 * with it and to nothing else. `run` rebuilds its targets from the events it is handed rather than
 * from the surrounding batch, which is what lets a failed group be re-run over a subset.
 */
type TDeliveryGroup = Readonly<{
  events: ReadonlyArray<TAuthzedOutboxEvent>;
  run: (events: ReadonlyArray<TAuthzedOutboxEvent>) => Promise<TAuthzedProjectionResult>;
}>;

const buildDeliveryGroups = (grouped: TGroupedEvents): ReadonlyArray<TDeliveryGroup> => {
  const collect = (
    ...targetTypes: ReadonlyArray<TAuthzedOutboxTargetType>
  ): ReadonlyArray<TAuthzedOutboxEvent> => targetTypes.flatMap((type) => [...(grouped.get(type) ?? [])]);

  const groups: ReadonlyArray<TDeliveryGroup> = [
    {
      events: collect("membership"),
      run: (events) =>
        runChunkedProjection(reconcileOrganizationMemberships, {
          memberships: secondaryTargets(events).map(({ primaryId, secondaryId }) => ({
            organizationId: primaryId,
            userId: secondaryId,
          })),
        }),
    },
    { events: collect("organization"), run: reconcileOrganizations },
    { events: collect("user"), run: reconcileUsers },
    {
      events: collect("team", "team_membership", "workspace", "workspace_team"),
      run: (events) =>
        runChunkedProjection(reconcileTeamWorkspaceRelationships, {
          teamIds: byType(events, "team").map(({ primaryId }) => primaryId),
          teamMemberships: secondaryTargets(byType(events, "team_membership")).map(
            ({ primaryId, secondaryId }) => ({ teamId: primaryId, userId: secondaryId })
          ),
          workspaceIds: byType(events, "workspace").map(({ primaryId }) => primaryId),
          workspaceTeamGrants: secondaryTargets(byType(events, "workspace_team")).map(
            ({ primaryId, secondaryId }) => ({ teamId: secondaryId, workspaceId: primaryId })
          ),
        }),
    },
    {
      events: collect("api_key", "api_key_workspace"),
      run: (events) =>
        runChunkedProjection(reconcileApiKeyRelationships, {
          apiKeyIds: byType(events, "api_key").map(({ primaryId }) => primaryId),
          apiKeyWorkspaceGrants: secondaryTargets(byType(events, "api_key_workspace")).map(
            ({ primaryId, secondaryId }) => ({ apiKeyId: primaryId, workspaceId: secondaryId })
          ),
        }),
    },
    {
      events: collect("feedback_directory", "feedback_directory_assignment"),
      run: (events) =>
        runChunkedProjection(reconcileFeedbackDirectoryRelationships, {
          assignments: secondaryTargets(byType(events, "feedback_directory_assignment")).map(
            ({ primaryId, secondaryId }) => ({ feedbackDirectoryId: primaryId, workspaceId: secondaryId })
          ),
          feedbackDirectoryIds: byType(events, "feedback_directory").map(({ primaryId }) => primaryId),
        }),
    },
  ];

  return groups.filter(({ events }) => events.length > 0);
};

const sanitizeDeliveryError = (error: unknown): string => {
  if (error instanceof Error && error.message.startsWith("authzed_")) return error.message;
  return DELIVERY_ERROR_CODE;
};

type TGroupOutcome =
  | Readonly<{ status: "projected" }>
  | Readonly<{ code: string; retryable: boolean; status: "failed" }>;

const runGroup = async (
  group: TDeliveryGroup,
  events: ReadonlyArray<TAuthzedOutboxEvent>
): Promise<TGroupOutcome> => {
  let result: TAuthzedProjectionResult;
  try {
    result = await group.run(events);
  } catch (error) {
    // Reconcilers never throw — `runBestEffortProjection` converts failures into a result — but the
    // PostgreSQL reads this module makes around them can. Treat that as transient rather than as a
    // fault attributable to any single event.
    return { code: sanitizeDeliveryError(error), retryable: true, status: "failed" };
  }

  if (result.status === "projected") return { status: "projected" };
  // AuthZed switched off mid-batch: nothing was attempted, so nothing is anyone's fault.
  if (result.status === "disabled") return { code: DISABLED_ERROR_CODE, retryable: true, status: "failed" };

  return {
    code: result.code,
    // A source row that kept moving under the reconciler will settle. That is a retry, not a poison —
    // and it is likeliest on exactly the hot rows the outbox carries. Overridden here rather than on
    // `AuthzedProjectionUnstableError`, whose `retryable: false` is part of the projector contract.
    retryable: result.retryable || result.code === UNSTABLE_ERROR_CODE,
    status: "failed",
  };
};

type TFailure = Readonly<{
  /**
   * The failure names THIS event: the attempt covered it alone, AND the code is one an event can
   * actually cause.
   *
   * Both halves are load-bearing. A single-event group is the normal case on a five-second cadence,
   * so size alone would charge a permanent failure to whichever events happened to be travelling
   * alone when SpiceDB rejected the credential — the same codes this module already refuses to split
   * on precisely because they describe the instance rather than an event.
   */
  attributable: boolean;
  code: string;
  eventIds: ReadonlyArray<string>;
  retryable: boolean;
}>;

type TDeliveryOutcome = Readonly<{
  delivered: ReadonlyArray<string>;
  failures: ReadonlyArray<TFailure>;
  /** Set when delivery hit a transient fault: stop spending retry budget against it this tick. */
  haltCode: string | null;
}>;

const failureOutcome = (
  events: ReadonlyArray<TAuthzedOutboxEvent>,
  outcome: Extract<TGroupOutcome, { status: "failed" }>
): TDeliveryOutcome => ({
  delivered: [],
  failures: [
    {
      attributable: events.length === 1 && PER_EVENT_ERROR_CODES.has(outcome.code),
      code: outcome.code,
      eventIds: events.map(({ id }) => id),
      retryable: outcome.retryable,
    },
  ],
  haltCode: outcome.retryable ? outcome.code : null,
});

/**
 * Deliver one group, halving it to isolate the culprit when the failure could be a single event's.
 *
 * Without this, one cross-tenant assignment row fails every feedback-directory event in every batch
 * for as long as it exists. With it, the poison event is alone by the time it is charged a permanent
 * failure — which is the precondition for dead-lettering ever being attributable.
 */
const deliverGroup = async (
  group: TDeliveryGroup,
  events: ReadonlyArray<TAuthzedOutboxEvent>,
  depth: number
): Promise<TDeliveryOutcome> => {
  const outcome = await runGroup(group, events);
  if (outcome.status === "projected") {
    return { delivered: events.map(({ id }) => id), failures: [], haltCode: null };
  }

  const splittable =
    events.length > 1 &&
    !outcome.retryable &&
    PER_EVENT_ERROR_CODES.has(outcome.code) &&
    depth < MAX_QUARANTINE_DEPTH;
  if (!splittable) return failureOutcome(events, outcome);

  const middle = Math.ceil(events.length / 2);
  const left = await deliverGroup(group, events.slice(0, middle), depth + 1);
  if (left.haltCode) {
    const untried = events.slice(middle).map(({ id }) => id);
    return {
      delivered: left.delivered,
      failures: [
        ...left.failures,
        ...(untried.length > 0
          ? [{ attributable: false, code: left.haltCode, eventIds: untried, retryable: true }]
          : []),
      ],
      haltCode: left.haltCode,
    };
  }

  const right = await deliverGroup(group, events.slice(middle), depth + 1);
  return {
    delivered: [...left.delivered, ...right.delivered],
    failures: [...left.failures, ...right.failures],
    haltCode: right.haltCode,
  };
};

const deliverEventGroups = async (grouped: TGroupedEvents): Promise<TDeliveryOutcome> => {
  const groups = buildDeliveryGroups(grouped);
  const delivered: string[] = [];
  const failures: TFailure[] = [];

  for (const [index, group] of groups.entries()) {
    const outcome = await deliverGroup(group, group.events, 0);
    delivered.push(...outcome.delivered);
    failures.push(...outcome.failures);

    if (outcome.haltCode) {
      // Continuing would spend another three-attempt retry budget per remaining group against an
      // instance already known to be unreachable. Release the rest untried and unblamed.
      const untried = groups.slice(index + 1).flatMap(({ events }) => events.map(({ id }) => id));
      if (untried.length > 0) {
        failures.push({ attributable: false, code: outcome.haltCode, eventIds: untried, retryable: true });
      }
      return { delivered, failures, haltCode: outcome.haltCode };
    }
  }

  return { delivered, failures, haltCode: null };
};

/** One release statement per distinct verdict rather than per failure record. */
const mergeFailures = (failures: ReadonlyArray<TFailure>): ReadonlyArray<TFailure> => {
  const merged = new Map<string, TFailure & { eventIds: string[] }>();
  for (const failure of failures) {
    const key = `${failure.code}:${String(failure.attributable)}:${String(failure.retryable)}`;
    const existing = merged.get(key);
    if (existing) existing.eventIds.push(...failure.eventIds);
    else merged.set(key, { ...failure, eventIds: [...failure.eventIds] });
  }
  return [...merged.values()];
};

export const processAuthzedOutboxBatch = async (
  leaseOwner = createAuthzedOutboxLeaseOwner(),
  batchSize = AUTHZED_OUTBOX_BATCH_SIZE
): Promise<Readonly<{ claimed: number; deadLettered: number; delivered: number; failed: number }>> => {
  const events = await claimAuthzedOutboxEvents(leaseOwner, batchSize);
  if (events.length === 0) return { claimed: 0, deadLettered: 0, delivered: 0, failed: 0 };

  const startedAt = performance.now();
  const outcome = await deliverEventGroups(groupEvents(events));
  const durationMs = performance.now() - startedAt;

  await markAuthzedOutboxEventsDelivered(leaseOwner, outcome.delivered);

  const deliveredAt = Date.now();
  const deliveredIds = new Set(outcome.delivered);
  for (const event of events) {
    if (event.isRevocation && deliveredIds.has(event.id)) {
      recordAuthzedRevocationDelivery(deliveredAt - event.createdAt.getTime());
    }
  }

  let deadLettered = 0;
  let failed = 0;
  for (const failure of mergeFailures(outcome.failures)) {
    failed += failure.eventIds.length;
    deadLettered += await markAuthzedOutboxEventsFailed(leaseOwner, failure.eventIds, failure.code, {
      attributable: failure.attributable,
      retryable: failure.retryable,
    });
  }

  if (outcome.delivered.length > 0) {
    recordAuthzedOutboxDelivery({ count: outcome.delivered.length, durationMs, status: "delivered" });
  }

  if (failed > 0) {
    logger.warn(
      {
        component: "authzed",
        count: failed,
        deadLettered,
        // Stable enumerable codes only — never an event, target, or tenant identifier.
        errorCodes: [...new Set(outcome.failures.map(({ code }) => code))].sort((left, right) =>
          left.localeCompare(right)
        ),
        operation: "projection_outbox_delivery",
        status: "failed",
      },
      "AuthZed projection outbox delivery failed"
    );
    recordAuthzedOutboxDelivery({ count: failed, durationMs, status: "failed" });
  }

  return { claimed: events.length, deadLettered, delivered: outcome.delivered.length, failed };
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
    // A partial batch is the normal outcome once failures are attributed per group, so draining stops
    // on no progress rather than on any failure. Delivered rows get `processedAt` and failed rows a
    // future `availableAt`, so every iteration strictly shrinks the claimable set.
    if (result.claimed === 0 || result.delivered === 0) break;
  }

  const status = await getAuthzedOutboxStatus();
  recordAuthzedOutboxStatus(status);
  return { ...totals, remaining: status.pending, status: status.pending === 0 ? "drained" : "partial" };
};

export const processAuthzedProjectionDeliveryJob = async (): Promise<void> => {
  if (!isAuthzedEnabled()) return;
  await drainAuthzedOutbox(10);
};
