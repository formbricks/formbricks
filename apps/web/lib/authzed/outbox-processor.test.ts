import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { reconcileApiKeyRelationships } from "./api-key";
import { isAuthzedEnabled } from "./config";
import { reconcileFeedbackDirectoryRelationships } from "./feedback-directory";
import { recordAuthzedRevocationDelivery } from "./metrics";
import {
  deleteOrganizationRelationships,
  deleteUserOrganizationRelationships,
  reconcileOrganizationMemberships,
} from "./organization-membership";
import { processAuthzedOutboxBatch, processAuthzedProjectionDeliveryJob } from "./outbox-processor";
import {
  claimAuthzedOutboxEvents,
  getAuthzedOutboxStatus,
  markAuthzedOutboxEventsDelivered,
  markAuthzedOutboxEventsFailed,
} from "./outbox-repository";
import type { TAuthzedOutboxEvent, TAuthzedOutboxTargetType } from "./outbox-types";
import { deleteUserTeamRelationships, reconcileTeamWorkspaceRelationships } from "./team-workspace";

vi.mock("@formbricks/database", () => ({
  prisma: {
    organization: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));
vi.mock("@formbricks/logger", () => ({ logger: { warn: vi.fn() } }));
vi.mock("./api-key", () => ({ reconcileApiKeyRelationships: vi.fn() }));
vi.mock("./config", () => ({ isAuthzedEnabled: vi.fn() }));
vi.mock("./feedback-directory", () => ({ reconcileFeedbackDirectoryRelationships: vi.fn() }));
vi.mock("./metrics", () => ({
  recordAuthzedOutboxDelivery: vi.fn(),
  recordAuthzedOutboxStatus: vi.fn(),
  recordAuthzedRevocationDelivery: vi.fn(),
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
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
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
    const events = [
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
    expect(markAuthzedOutboxEventsDelivered).toHaveBeenCalledWith(
      "lease",
      events.map(({ id }) => id)
    );
  });

  test("releases a failed lease for retry without logging identifiers", async () => {
    const events = [event("membership", "private-org", "private-user")];
    vi.mocked(claimAuthzedOutboxEvents).mockResolvedValue(events);
    vi.mocked(reconcileOrganizationMemberships).mockResolvedValue({
      attempts: 3,
      code: "authzed_unavailable",
      retryable: true,
      status: "failed",
    });

    await expect(processAuthzedOutboxBatch("lease")).resolves.toMatchObject({ failed: 1 });
    expect(markAuthzedOutboxEventsFailed).toHaveBeenCalledWith("lease", events, "authzed_unavailable");
  });

  test("records revocation propagation after successful delivery without identifier labels", async () => {
    const revocation = { ...event("workspace_team", "workspace", "team"), isRevocation: true };
    vi.mocked(claimAuthzedOutboxEvents).mockResolvedValue([revocation]);

    await processAuthzedOutboxBatch("lease");

    expect(recordAuthzedRevocationDelivery).toHaveBeenCalledOnce();
    expect(recordAuthzedRevocationDelivery).toHaveBeenCalledWith(expect.any(Number));
  });

  test("does not touch PostgreSQL when AuthZed is disabled", async () => {
    vi.mocked(isAuthzedEnabled).mockReturnValue(false);
    await processAuthzedProjectionDeliveryJob();
    expect(claimAuthzedOutboxEvents).not.toHaveBeenCalled();
  });
});
