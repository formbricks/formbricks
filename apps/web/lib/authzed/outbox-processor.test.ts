import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { reconcileApiKeyRelationships } from "./api-key";
import { isAuthzedEnabled } from "./config";
import { reconcileFeedbackDirectoryRelationships } from "./feedback-directory";
import {
  deleteOrganizationRelationships,
  deleteUserOrganizationRelationships,
  reconcileOrganizationMemberships,
} from "./organization-membership";
import {
  drainAuthzedOutbox,
  processAuthzedOutboxBatch,
  processAuthzedProjectionDeliveryJob,
} from "./outbox-processor";
import {
  claimAuthzedOutboxEvents,
  getAuthzedOutboxStatus,
  markAuthzedOutboxEventsDelivered,
  markAuthzedOutboxEventsFailed,
} from "./outbox-repository";
import type { TAuthzedOutboxEvent, TAuthzedOutboxTargetType } from "./outbox-types";
import type { TAuthzedProjectionResult } from "./projection";
import { deleteUserTeamRelationships, reconcileTeamWorkspaceRelationships } from "./team-workspace";

vi.mock("@formbricks/database", () => ({
  prisma: {
    organization: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));
vi.mock("@formbricks/logger", () => ({ logger: { warn: vi.fn() } }));
vi.mock("./api-key", () => ({ reconcileApiKeyRelationships: vi.fn() }));
vi.mock("./config", () => ({ isAuthzedEnabled: vi.fn() }));
vi.mock("./feedback-directory", () => ({ reconcileFeedbackDirectoryRelationships: vi.fn() }));
vi.mock("./metrics", () => ({
  recordAuthzedOutboxDelivery: vi.fn(),
  recordAuthzedOutboxStatus: vi.fn(),
}));
vi.mock("./organization-membership", () => ({
  deleteOrganizationRelationships: vi.fn(),
  deleteUserOrganizationRelationships: vi.fn(),
  reconcileOrganizationMemberships: vi.fn(),
}));
vi.mock("./outbox-repository", () => ({
  AUTHZED_OUTBOX_BATCH_SIZE: 200,
  claimAuthzedOutboxEvents: vi.fn(),
  createAuthzedOutboxLeaseOwner: vi.fn(() => "lease"),
  getAuthzedOutboxStatus: vi.fn(),
  markAuthzedOutboxEventsDelivered: vi.fn(),
  markAuthzedOutboxEventsFailed: vi.fn(),
}));
vi.mock("./team-workspace", () => ({
  deleteUserTeamRelationships: vi.fn(),
  reconcileTeamWorkspaceRelationships: vi.fn(),
}));

const projected = { passes: 1, status: "projected" } as const;

type TFailedProjectionResult = Extract<TAuthzedProjectionResult, { status: "failed" }>;

const failed = (code: TFailedProjectionResult["code"], retryable: boolean): TFailedProjectionResult => ({
  attempts: 3,
  code,
  retryable,
  status: "failed",
});

const event = (
  targetType: TAuthzedOutboxTargetType,
  primaryId: string,
  secondaryId: string | null = null
): TAuthzedOutboxEvent => ({
  attempts: 1,
  createdAt: new Date(0),
  id: `${targetType}-${primaryId}-${secondaryId ?? ""}`,
  isRevocation: false,
  primaryId,
  secondaryId,
  targetType,
});

/** Every target type, one event each, in the order `buildDeliveryGroups` consumes them. */
const everyTarget = (): ReadonlyArray<TAuthzedOutboxEvent> => [
  event("organization", "org"),
  event("membership", "org", "user"),
  event("user", "deleted-user"),
  event("team", "team"),
  event("team_membership", "team", "user"),
  event("workspace", "workspace"),
  event("workspace_team", "workspace", "team"),
  event("api_key", "key"),
  event("api_key_workspace", "key", "workspace"),
  event("feedback_directory", "directory"),
  event("feedback_directory_assignment", "directory", "workspace"),
];

const sorted = (ids: ReadonlyArray<string>): ReadonlyArray<string> =>
  [...ids].sort((left, right) => left.localeCompare(right));

/** Sorted because delivery reports in group order, which is not the order events were claimed in. */
const deliveredIds = (): ReadonlyArray<string> =>
  sorted(vi.mocked(markAuthzedOutboxEventsDelivered).mock.calls.flatMap(([, ids]) => [...ids]));

describe("AuthZed projection outbox processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAuthzedEnabled).mockReturnValue(true);
    vi.mocked(reconcileOrganizationMemberships).mockResolvedValue(projected);
    vi.mocked(deleteOrganizationRelationships).mockResolvedValue(projected);
    vi.mocked(deleteUserOrganizationRelationships).mockResolvedValue(projected);
    vi.mocked(deleteUserTeamRelationships).mockResolvedValue(projected);
    vi.mocked(reconcileTeamWorkspaceRelationships).mockResolvedValue(projected);
    vi.mocked(reconcileApiKeyRelationships).mockResolvedValue(projected);
    vi.mocked(reconcileFeedbackDirectoryRelationships).mockResolvedValue(projected);
    vi.mocked(prisma.organization.findMany).mockResolvedValue([]);
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);
    vi.mocked(markAuthzedOutboxEventsFailed).mockResolvedValue(0);
    vi.mocked(getAuthzedOutboxStatus).mockResolvedValue({
      deadLettered: 0,
      oldestPendingAgeSeconds: null,
      overdueRevocations: 0,
      pending: 0,
      revocationsPastCritical: 0,
      revocationsPastWarning: 0,
    });
  });

  test("maps every durable target to the existing idempotent reconcilers", async () => {
    const events = everyTarget();
    vi.mocked(claimAuthzedOutboxEvents).mockResolvedValue(events);

    await expect(processAuthzedOutboxBatch("lease")).resolves.toEqual({
      claimed: 11,
      deadLettered: 0,
      delivered: 11,
      failed: 0,
    });

    expect(reconcileOrganizationMemberships).toHaveBeenCalledWith({
      memberships: [{ organizationId: "org", userId: "user" }],
    });
    expect(deleteOrganizationRelationships).toHaveBeenCalledWith("org");
    expect(deleteUserOrganizationRelationships).toHaveBeenCalledWith("deleted-user");
    expect(deleteUserTeamRelationships).toHaveBeenCalledWith("deleted-user");
    expect(reconcileTeamWorkspaceRelationships).toHaveBeenCalledWith({
      teamIds: ["team"],
      teamMemberships: [{ teamId: "team", userId: "user" }],
      workspaceIds: ["workspace"],
      workspaceTeamGrants: [{ teamId: "team", workspaceId: "workspace" }],
    });
    expect(reconcileApiKeyRelationships).toHaveBeenCalledWith({
      apiKeyIds: ["key"],
      apiKeyWorkspaceGrants: [{ apiKeyId: "key", workspaceId: "workspace" }],
    });
    expect(reconcileFeedbackDirectoryRelationships).toHaveBeenCalledWith({
      assignments: [{ feedbackDirectoryId: "directory", workspaceId: "workspace" }],
      feedbackDirectoryIds: ["directory"],
    });
    expect(deliveredIds()).toEqual(sorted(events.map(({ id }) => id)));
  });

  test("delivers every healthy group when one of them fails", async () => {
    const events = everyTarget();
    vi.mocked(claimAuthzedOutboxEvents).mockResolvedValue(events);
    vi.mocked(reconcileApiKeyRelationships).mockResolvedValue(failed("authzed_internal", false));

    await expect(processAuthzedOutboxBatch("lease")).resolves.toMatchObject({
      delivered: 9,
      failed: 2,
    });

    const apiKeyIds = events
      .filter(({ targetType }) => targetType === "api_key" || targetType === "api_key_workspace")
      .map(({ id }) => id);
    expect(deliveredIds()).toEqual(
      sorted(events.filter(({ id }) => !apiKeyIds.includes(id)).map(({ id }) => id))
    );
    expect(markAuthzedOutboxEventsFailed).toHaveBeenCalledWith("lease", apiKeyIds, "authzed_internal", {
      attributable: false,
      retryable: false,
    });
  });

  test("stops spending retry budget once a fault is known to be transient", async () => {
    vi.mocked(claimAuthzedOutboxEvents).mockResolvedValue(everyTarget());
    // The membership group runs first, so a retryable failure there must release the rest untried.
    vi.mocked(reconcileOrganizationMemberships).mockResolvedValue(failed("authzed_unavailable", true));

    await expect(processAuthzedOutboxBatch("lease")).resolves.toMatchObject({ delivered: 0, failed: 11 });

    expect(reconcileTeamWorkspaceRelationships).not.toHaveBeenCalled();
    expect(reconcileApiKeyRelationships).not.toHaveBeenCalled();
    expect(reconcileFeedbackDirectoryRelationships).not.toHaveBeenCalled();
    // Nothing here earned a permanent failure: dead-lettering needs `!retryable && isolated`, and a
    // transient fault never satisfies the first half however the events happened to be grouped.
    for (const [, , , attribution] of vi.mocked(markAuthzedOutboxEventsFailed).mock.calls) {
      expect(attribution).toMatchObject({ retryable: true });
    }
  });

  test("keeps going when a failure is local to one group", async () => {
    vi.mocked(claimAuthzedOutboxEvents).mockResolvedValue(everyTarget());
    vi.mocked(reconcileOrganizationMemberships).mockResolvedValue(failed("authzed_internal", false));

    await processAuthzedOutboxBatch("lease");

    expect(reconcileTeamWorkspaceRelationships).toHaveBeenCalled();
    expect(reconcileApiKeyRelationships).toHaveBeenCalled();
    expect(reconcileFeedbackDirectoryRelationships).toHaveBeenCalled();
  });

  test("treats an unstable source snapshot as transient rather than as a poison event", async () => {
    vi.mocked(claimAuthzedOutboxEvents).mockResolvedValue([event("membership", "org", "user")]);
    // The projector reports this as non-retryable, but it means the row moved under the reconciler.
    vi.mocked(reconcileOrganizationMemberships).mockResolvedValue(
      failed("authzed_projection_unstable", false)
    );

    await processAuthzedOutboxBatch("lease");

    expect(markAuthzedOutboxEventsFailed).toHaveBeenCalledWith(
      "lease",
      ["membership-org-user"],
      "authzed_projection_unstable",
      // Retryable is what matters: it is what keeps the event out of the dead-letter budget.
      { attributable: false, retryable: true }
    );
  });

  test("does not blame a lone event for a failure that describes the instance", async () => {
    // A five-second cadence means most groups hold exactly one event, so "the attempt covered one
    // event" is nearly always true and says nothing about fault. If size alone drove attribution, a
    // rotated SpiceDB credential would dead-letter whichever revocations happened to be travelling
    // alone — and a dead-lettered revocation denies the whole deployment until something replays it.
    for (const code of [
      "authzed_unauthenticated",
      "authzed_internal",
      "authzed_permission_denied",
    ] as const) {
      vi.clearAllMocks();
      vi.mocked(markAuthzedOutboxEventsFailed).mockResolvedValue(0);
      vi.mocked(claimAuthzedOutboxEvents).mockResolvedValue([event("membership", "org", "user")]);
      vi.mocked(reconcileOrganizationMemberships).mockResolvedValue(failed(code, false));

      await processAuthzedOutboxBatch("lease");

      expect(markAuthzedOutboxEventsFailed).toHaveBeenCalledWith("lease", ["membership-org-user"], code, {
        attributable: false,
        retryable: false,
      });
    }
  });

  test("isolates the one event a per-event failure is attributable to", async () => {
    const events = ["a", "b", "c", "d"].map((suffix) =>
      event("feedback_directory_assignment", `directory-${suffix}`, "workspace")
    );
    const poison = events[2];
    vi.mocked(claimAuthzedOutboxEvents).mockResolvedValue(events);
    vi.mocked(reconcileFeedbackDirectoryRelationships).mockImplementation(({ assignments }) =>
      Promise.resolve(
        (assignments ?? []).some(({ feedbackDirectoryId }) => feedbackDirectoryId === poison.primaryId)
          ? failed("authzed_projection_invalid_source", false)
          : projected
      )
    );

    await expect(processAuthzedOutboxBatch("lease")).resolves.toMatchObject({ delivered: 3, failed: 1 });

    expect(deliveredIds()).toEqual(sorted(events.filter(({ id }) => id !== poison.id).map(({ id }) => id)));
    expect(markAuthzedOutboxEventsFailed).toHaveBeenCalledWith(
      "lease",
      [poison.id],
      "authzed_projection_invalid_source",
      { attributable: true, retryable: false }
    );
  });

  test("does not split a group for a failure that describes the instance", async () => {
    const events = ["a", "b", "c", "d"].map((suffix) =>
      event("feedback_directory_assignment", `directory-${suffix}`, "workspace")
    );
    vi.mocked(claimAuthzedOutboxEvents).mockResolvedValue(events);
    vi.mocked(reconcileFeedbackDirectoryRelationships).mockResolvedValue(failed("authzed_internal", false));

    await processAuthzedOutboxBatch("lease");

    // One call, not the 2N a blind split would spend every five seconds against a broken instance.
    expect(reconcileFeedbackDirectoryRelationships).toHaveBeenCalledOnce();
    expect(markAuthzedOutboxEventsFailed).toHaveBeenCalledWith(
      "lease",
      events.map(({ id }) => id),
      "authzed_internal",
      { attributable: false, retryable: false }
    );
  });

  test("reads every claimed user once and treats a missing row as inactive", async () => {
    vi.mocked(claimAuthzedOutboxEvents).mockResolvedValue([
      event("user", "active-one"),
      event("user", "active-two"),
      event("user", "active-two"),
      event("user", "gone"),
    ]);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      {
        id: "active-one",
        isActive: true,
        memberships: [{ organizationId: "org-1" }],
        teamUsers: [{ teamId: "team-1" }],
      },
      {
        id: "active-two",
        isActive: true,
        memberships: [{ organizationId: "org-2" }],
        teamUsers: [],
      },
    ] as never);

    await processAuthzedOutboxBatch("lease");

    expect(prisma.user.findMany).toHaveBeenCalledOnce();
    expect(vi.mocked(prisma.user.findMany).mock.calls[0][0]).toMatchObject({
      where: { id: { in: ["active-one", "active-two", "gone"] } },
    });
    expect(deleteUserOrganizationRelationships).toHaveBeenCalledExactlyOnceWith("gone");
    expect(deleteUserTeamRelationships).toHaveBeenCalledExactlyOnceWith("gone");
    expect(reconcileOrganizationMemberships).toHaveBeenCalledExactlyOnceWith({
      memberships: [
        { organizationId: "org-1", userId: "active-one" },
        { organizationId: "org-2", userId: "active-two" },
      ],
    });
    expect(reconcileTeamWorkspaceRelationships).toHaveBeenCalledExactlyOnceWith({
      teamMemberships: [{ teamId: "team-1", userId: "active-one" }],
    });
  });

  test("keeps draining while batches make progress and stops when one makes none", async () => {
    const events = [event("membership", "org", "user")];
    vi.mocked(claimAuthzedOutboxEvents)
      .mockResolvedValueOnce(events)
      .mockResolvedValueOnce(events)
      .mockResolvedValueOnce([]);

    await drainAuthzedOutbox(10);
    expect(claimAuthzedOutboxEvents).toHaveBeenCalledTimes(3);

    vi.mocked(claimAuthzedOutboxEvents).mockReset().mockResolvedValue(events);
    vi.mocked(reconcileOrganizationMemberships).mockResolvedValue(failed("authzed_unavailable", true));

    await drainAuthzedOutbox(10);
    expect(claimAuthzedOutboxEvents).toHaveBeenCalledOnce();
  });

  test("does not touch PostgreSQL when AuthZed is disabled", async () => {
    vi.mocked(isAuthzedEnabled).mockReturnValue(false);
    await processAuthzedProjectionDeliveryJob();
    expect(claimAuthzedOutboxEvents).not.toHaveBeenCalled();
  });
});
