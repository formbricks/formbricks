import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { type TAuthzedRelationshipUpdate, getAuthzedClient } from "./client";
import { isAuthzedEnabled } from "./config";
import { reconcileFeedbackDirectoryRelationships } from "./feedback-directory";
import { getFeedbackDirectoryAssignmentObjectId } from "./feedback-directory-assignment-id";

vi.mock("node:crypto", async (importOriginal) => importOriginal());

const client = {
  deleteRelationships: vi.fn(),
  writeRelationships: vi.fn(),
};

vi.mock("@formbricks/database", () => ({
  prisma: {
    feedbackDirectory: { findMany: vi.fn() },
    feedbackDirectoryWorkspace: { findMany: vi.fn() },
    workspace: { findMany: vi.fn() },
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: { debug: vi.fn(), warn: vi.fn() },
}));

vi.mock("./client", () => ({ getAuthzedClient: vi.fn() }));
vi.mock("./config", () => ({ isAuthzedEnabled: vi.fn() }));

const DIRECTORY_ID = "directory-private-id";
const WORKSPACE_ID = "workspace-private-id";
const ORGANIZATION_ID = "organization-private-id";

const directory = (
  workspaces: ReadonlyArray<string> = [WORKSPACE_ID],
  overrides: Readonly<Partial<{ isArchived: boolean; organizationId: string }>> = {}
) => ({
  id: DIRECTORY_ID,
  isArchived: false,
  organizationId: ORGANIZATION_ID,
  workspaces: workspaces.map((workspaceId) => ({
    workspace: { organizationId: ORGANIZATION_ID },
    workspaceId,
  })),
  ...overrides,
});

const setStableSnapshot = (
  directories: ReadonlyArray<ReturnType<typeof directory>> = [directory()]
): void => {
  vi.mocked(prisma.feedbackDirectory.findMany).mockResolvedValue(directories as never);
  vi.mocked(prisma.feedbackDirectoryWorkspace.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.workspace.findMany).mockResolvedValue([] as never);
};

describe("feedback directory relationship projection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAuthzedEnabled).mockReturnValue(true);
    vi.mocked(getAuthzedClient).mockReturnValue(client as unknown as ReturnType<typeof getAuthzedClient>);
    client.deleteRelationships.mockResolvedValue(undefined);
    client.writeRelationships.mockResolvedValue(undefined);
    setStableSnapshot();
  });

  test("projects directory and workspace parents plus the exact three-edge assignment", async () => {
    await expect(
      reconcileFeedbackDirectoryRelationships({ feedbackDirectoryIds: [DIRECTORY_ID] })
    ).resolves.toEqual({ passes: 1, status: "projected" });

    const updates = client.writeRelationships.mock.calls.flatMap(([batch]) => batch);
    const assignmentId = getFeedbackDirectoryAssignmentObjectId(DIRECTORY_ID, WORKSPACE_ID);
    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: "touch",
          relationship: expect.objectContaining({
            relation: "organization",
            resource: { objectId: DIRECTORY_ID, objectType: "feedback_directory" },
          }),
        }),
        expect.objectContaining({
          operation: "touch",
          relationship: {
            relation: "assignment",
            resource: { objectId: DIRECTORY_ID, objectType: "feedback_directory" },
            subject: { objectId: assignmentId, objectType: "feedback_directory_assignment" },
          },
        }),
        expect.objectContaining({
          operation: "touch",
          relationship: expect.objectContaining({
            relation: "directory",
            resource: { objectId: assignmentId, objectType: "feedback_directory_assignment" },
          }),
        }),
        expect.objectContaining({
          operation: "touch",
          relationship: expect.objectContaining({
            relation: "workspace",
            resource: { objectId: assignmentId, objectType: "feedback_directory_assignment" },
          }),
        }),
      ])
    );
  });

  test("removes all three edges for archived and removed assignments", async () => {
    setStableSnapshot([directory([WORKSPACE_ID], { isArchived: true })]);

    await reconcileFeedbackDirectoryRelationships({ feedbackDirectoryIds: [DIRECTORY_ID] });
    let assignmentUpdates = client.writeRelationships.mock.calls
      .flatMap(([batch]) => batch)
      .filter(({ relationship }) => relationship.relation !== "organization");
    expect(assignmentUpdates).toHaveLength(3);
    expect(assignmentUpdates.every(({ operation }) => operation === "delete")).toBe(true);

    vi.clearAllMocks();
    vi.mocked(isAuthzedEnabled).mockReturnValue(true);
    vi.mocked(getAuthzedClient).mockReturnValue(client as unknown as ReturnType<typeof getAuthzedClient>);
    client.deleteRelationships.mockResolvedValue(undefined);
    client.writeRelationships.mockResolvedValue(undefined);
    setStableSnapshot([directory([])]);
    await reconcileFeedbackDirectoryRelationships({
      assignments: [{ feedbackDirectoryId: DIRECTORY_ID, workspaceId: WORKSPACE_ID }],
    });
    assignmentUpdates = client.writeRelationships.mock.calls
      .flatMap(([batch]) => batch)
      .filter(({ relationship }) => relationship.relation !== "organization");
    expect(assignmentUpdates).toHaveLength(3);
    expect(assignmentUpdates.every(({ operation }) => operation === "delete")).toBe(true);
  });

  test("rejects a cross-organization source before writing relationships", async () => {
    setStableSnapshot([directory([WORKSPACE_ID], { organizationId: "other-organization" })]);

    await expect(
      reconcileFeedbackDirectoryRelationships({ feedbackDirectoryIds: [DIRECTORY_ID] })
    ).resolves.toEqual({
      attempts: 1,
      code: "authzed_projection_invalid_source",
      retryable: false,
      status: "failed",
    });
    expect(client.writeRelationships).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(logger.warn).mock.calls)).not.toContain(DIRECTORY_ID);
    expect(JSON.stringify(vi.mocked(logger.warn).mock.calls)).not.toContain(WORKSPACE_ID);
  });

  test("removes resource-side and subject-side relationships for a missing directory", async () => {
    setStableSnapshot([]);

    await reconcileFeedbackDirectoryRelationships({ feedbackDirectoryIds: [DIRECTORY_ID] });

    expect(client.deleteRelationships).toHaveBeenCalledWith({
      resourceId: DIRECTORY_ID,
      resourceType: "feedback_directory",
    });
    expect(client.deleteRelationships).toHaveBeenCalledWith({
      resourceType: "feedback_directory_assignment",
      subject: { objectId: DIRECTORY_ID, objectType: "feedback_directory" },
    });
  });

  test("packs at most 1,000 operations without splitting an assignment group", async () => {
    const workspaceIds = Array.from({ length: 334 }, (_, index) => `workspace-${index}`);
    setStableSnapshot([directory(workspaceIds)]);

    await reconcileFeedbackDirectoryRelationships({ feedbackDirectoryIds: [DIRECTORY_ID] });

    const batches = client.writeRelationships.mock.calls.map(
      ([batch]) => batch as ReadonlyArray<TAuthzedRelationshipUpdate>
    );
    expect(batches.length).toBeGreaterThan(1);
    expect(batches.every((batch) => batch.length <= 1000)).toBe(true);
    for (const workspaceId of workspaceIds) {
      const assignmentId = getFeedbackDirectoryAssignmentObjectId(DIRECTORY_ID, workspaceId);
      const containingBatches = batches.filter((batch) =>
        batch.some(
          ({ relationship }) =>
            relationship.resource.objectId === assignmentId || relationship.subject.objectId === assignmentId
        )
      );
      expect(containingBatches).toHaveLength(1);
      expect(
        containingBatches[0].filter(
          ({ relationship }) =>
            relationship.resource.objectId === assignmentId || relationship.subject.objectId === assignmentId
        )
      ).toHaveLength(3);
    }
  });

  test("returns disabled before database access and treats an empty target set as a zero-pass no-op", async () => {
    vi.mocked(isAuthzedEnabled).mockReturnValue(false);
    await expect(
      reconcileFeedbackDirectoryRelationships({ feedbackDirectoryIds: [DIRECTORY_ID] })
    ).resolves.toEqual({ status: "disabled" });
    expect(prisma.feedbackDirectory.findMany).not.toHaveBeenCalled();
    expect(getAuthzedClient).not.toHaveBeenCalled();

    vi.mocked(isAuthzedEnabled).mockReturnValue(true);
    await expect(reconcileFeedbackDirectoryRelationships({})).resolves.toEqual({
      passes: 0,
      status: "projected",
    });
    expect(getAuthzedClient).not.toHaveBeenCalled();
  });

  test("retries a changing source snapshot and converges on the second pass", async () => {
    const first = directory([WORKSPACE_ID]);
    const changed = directory([]);
    vi.mocked(prisma.feedbackDirectory.findMany)
      .mockResolvedValueOnce([first] as never)
      .mockResolvedValueOnce([changed] as never)
      .mockResolvedValueOnce([changed] as never)
      .mockResolvedValueOnce([changed] as never);

    await expect(
      reconcileFeedbackDirectoryRelationships({ feedbackDirectoryIds: [DIRECTORY_ID] })
    ).resolves.toEqual({ passes: 2, status: "projected" });
  });

  test("reports an unstable source after three complete changing passes", async () => {
    const present = directory([WORKSPACE_ID]);
    const absent = directory([]);
    vi.mocked(prisma.feedbackDirectory.findMany)
      .mockResolvedValueOnce([present] as never)
      .mockResolvedValueOnce([absent] as never)
      .mockResolvedValueOnce([present] as never)
      .mockResolvedValueOnce([absent] as never)
      .mockResolvedValueOnce([present] as never)
      .mockResolvedValueOnce([absent] as never);

    await expect(
      reconcileFeedbackDirectoryRelationships({ feedbackDirectoryIds: [DIRECTORY_ID] })
    ).resolves.toEqual({
      attempts: 3,
      code: "authzed_projection_unstable",
      retryable: false,
      status: "failed",
    });
  });

  test("deduplicates repeated pair targets before writing their logical group", async () => {
    await reconcileFeedbackDirectoryRelationships({
      assignments: [
        { feedbackDirectoryId: DIRECTORY_ID, workspaceId: WORKSPACE_ID },
        { feedbackDirectoryId: DIRECTORY_ID, workspaceId: WORKSPACE_ID },
      ],
      feedbackDirectoryIds: [DIRECTORY_ID, DIRECTORY_ID],
    });

    const assignmentId = getFeedbackDirectoryAssignmentObjectId(DIRECTORY_ID, WORKSPACE_ID);
    const updates = client.writeRelationships.mock.calls
      .flatMap(([batch]) => batch)
      .filter(({ relationship }) => relationship.resource.objectId === assignmentId);
    expect(updates).toHaveLength(2);
  });
});
