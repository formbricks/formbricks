import { prisma } from "@/lib/__mocks__/database";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { type TAuthzedRelationship, type TAuthzedRelationshipUpdate, getAuthzedClient } from "./client";
import { isAuthzedEnabled } from "./config";
import { AUTHZED_MAX_PARALLEL_RELATIONSHIP_DELETES } from "./constants";
import { AUTHZED_ERROR_CODES, AuthzedError } from "./errors";
import {
  type TProjectedMcpGrant,
  deleteMcpGrantRelationshipsBeforeCommit,
  expectedMcpGrantRelationships,
  reconcileMcpGrantRelationships,
  removeDeletedMcpGrantRelationships,
} from "./mcp-grant";
import { queueAuthzedOutboxEvents } from "./outbox-repository";
import { readAllRelationships } from "./relationship-reads";

const clientMocks = { writeRelationships: vi.fn() };

vi.mock("@formbricks/logger", () => ({
  logger: { debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock("./client", () => ({ getAuthzedClient: vi.fn() }));
vi.mock("./config", () => ({ isAuthzedEnabled: vi.fn() }));
vi.mock("./relationship-reads", () => ({ readAllRelationships: vi.fn() }));
vi.mock("./outbox-repository", () => ({ queueAuthzedOutboxEvents: vi.fn() }));

const GRANT_ID = "grant-a";

const relationship = (
  resourceType: "organization" | "workspace",
  resourceId: string,
  grantId = GRANT_ID
): TAuthzedRelationship => ({
  relation: "mcp_grant",
  resource: { objectId: resourceId, objectType: resourceType },
  subject: { objectId: grantId, objectType: "mcp_grant" },
});

const grantRow = (
  overrides: Partial<{
    access: "all" | "organizations" | "workspaces";
    id: string;
    organizations: string[];
    workspaces: string[];
  }> = {}
) => ({
  access: overrides.access ?? "workspaces",
  id: overrides.id ?? GRANT_ID,
  organizations: (overrides.organizations ?? []).map((organizationId) => ({ organizationId })),
  workspaces: (overrides.workspaces ?? []).map((workspaceId) => ({ workspaceId })),
});

/** SpiceDB holds `observed`; keyed by `<resourceType>` for the grant being read. */
const observe = (observed: Record<string, ReadonlyArray<TAuthzedRelationship>>): void => {
  vi.mocked(readAllRelationships).mockImplementation(async (_client, filter) => ({
    relationships: (observed[filter.resourceType] ?? []).filter(
      (candidate) => candidate.subject.objectId === filter.subject?.objectId
    ),
    snapshot: null,
  }));
};

const writtenUpdates = (): TAuthzedRelationshipUpdate[] =>
  clientMocks.writeRelationships.mock.calls.flatMap(([batch]) => batch as TAuthzedRelationshipUpdate[]);

const schemaMissingMcpGrant = (): AuthzedError => {
  const details = "relation/permission `mcp_grant` not found under definition `workspace`";
  return new AuthzedError({
    attempts: 1,
    cause: Object.assign(new Error(`9 FAILED_PRECONDITION: ${details}`), { code: 9, details }),
    code: AUTHZED_ERROR_CODES.FAILED_PRECONDITION,
    operation: "write_relationships",
    retryable: false,
  });
};

const workspaces = (...workspaceIds: string[]): TProjectedMcpGrant => ({
  id: GRANT_ID,
  access: "workspaces",
  workspaceIds,
});

describe("expectedMcpGrantRelationships", () => {
  test("projects the selection the grant's access names", () => {
    expect(
      expectedMcpGrantRelationships({ id: GRANT_ID, access: "organizations", organizationIds: ["org-1"] })
    ).toEqual([relationship("organization", "org-1")]);
    expect(expectedMcpGrantRelationships(workspaces("ws-1", "ws-2"))).toEqual([
      relationship("workspace", "ws-1"),
      relationship("workspace", "ws-2"),
    ]);
    expect(expectedMcpGrantRelationships({ id: GRANT_ID, access: "all" })).toEqual([]);
  });
});

describe("reconcileMcpGrantRelationships", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The reconciling pass's transaction runs on the same mock, so its reads are the ones asserted.
    vi.mocked(prisma.$transaction).mockImplementation((async (callback: (tx: unknown) => unknown) =>
      callback(prisma)) as never);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);
    vi.mocked(isAuthzedEnabled).mockReturnValue(true);
    vi.mocked(getAuthzedClient).mockReturnValue(
      clientMocks as unknown as ReturnType<typeof getAuthzedClient>
    );
    clientMocks.writeRelationships.mockResolvedValue(undefined);
    observe({});
  });

  // The pass's row locks last until its transaction times out, and a SpiceDB write isn't part of it:
  // every write is held to a deadline 5 s short of the 30 s timeout, measured from the pass's start.
  test("holds every write to a deadline short of the pass's transaction timeout", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    vi.mocked(prisma.mcpGrant.findMany).mockResolvedValue([
      grantRow({ access: "workspaces", workspaces: ["ws-1"] }),
    ] as never);

    await reconcileMcpGrantRelationships({ grantIds: [GRANT_ID] });

    expect(clientMocks.writeRelationships).toHaveBeenCalledWith(expect.any(Array), {
      deadline: 1_000_000 + 30_000 - 5_000,
    });
    vi.mocked(Date.now).mockRestore();
  });

  test("sends no batch once the deadline has passed, and fails the pass", async () => {
    const now = vi
      .spyOn(Date, "now")
      .mockReturnValueOnce(1_000_000)
      .mockReturnValue(1_000_000 + 25_000);
    vi.mocked(prisma.mcpGrant.findMany).mockResolvedValue([
      grantRow({ access: "workspaces", workspaces: ["ws-1"] }),
    ] as never);

    await expect(reconcileMcpGrantRelationships({ grantIds: [GRANT_ID] })).resolves.toMatchObject({
      status: "failed",
    });
    expect(clientMocks.writeRelationships).not.toHaveBeenCalled();
    now.mockRestore();
  });

  // A write that missed its deadline may still commit just after it: the pass keeps its row locks through
  // the margin before failing, so the commit lands, if at all, before a narrowing can take them.
  test("keeps the locks through the margin after a write misses its deadline, then fails", async () => {
    vi.useFakeTimers({ now: 1_000_000 });
    try {
      vi.mocked(prisma.mcpGrant.findMany).mockResolvedValue([
        grantRow({ access: "workspaces", workspaces: ["ws-1"] }),
      ] as never);
      clientMocks.writeRelationships.mockImplementation(async () => {
        vi.setSystemTime(1_000_000 + 25_000);
        throw new AuthzedError({
          attempts: 3,
          code: AUTHZED_ERROR_CODES.TIMEOUT,
          grpcStatus: 4,
          operation: "write_relationships",
          retryable: true,
        });
      });
      let settled = false;
      const reconciling = reconcileMcpGrantRelationships({ grantIds: [GRANT_ID] }).finally(() => {
        settled = true;
      });

      // Held until a second before the transaction's timeout: 5 s of margin less 1 s of slack.
      await vi.advanceTimersByTimeAsync(3_900);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(100);
      await expect(reconciling).resolves.toMatchObject({ status: "failed" });
    } finally {
      vi.useRealTimers();
    }
  });

  // Should the transaction expire before the hold ends, Prisma rolls it back: the pass fails as any other
  // failed pass does, and the outbox delivers the event again.
  test("fails the pass when its transaction expires", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(
      new Error("A commit cannot be executed on an expired transaction")
    );

    await expect(reconcileMcpGrantRelationships({ grantIds: [GRANT_ID] })).resolves.toMatchObject({
      status: "failed",
    });
  });

  // A write refused outright (SpiceDB down) never reached SpiceDB: nothing to wait for.
  test("fails at once when a write fails for any other reason", async () => {
    vi.mocked(prisma.mcpGrant.findMany).mockResolvedValue([
      grantRow({ access: "workspaces", workspaces: ["ws-1"] }),
    ] as never);
    clientMocks.writeRelationships.mockRejectedValue(
      new AuthzedError({
        attempts: 3,
        code: AUTHZED_ERROR_CODES.UNAVAILABLE,
        grpcStatus: 14,
        operation: "write_relationships",
        retryable: true,
      })
    );
    const startedAt = Date.now();

    await expect(reconcileMcpGrantRelationships({ grantIds: [GRANT_ID] })).resolves.toMatchObject({
      status: "failed",
    });
    expect(Date.now() - startedAt).toBeLessThan(1_000);
  });

  test("reports disabled and touches nothing when AuthZed is off", async () => {
    vi.mocked(isAuthzedEnabled).mockReturnValue(false);

    await expect(reconcileMcpGrantRelationships({ grantIds: [GRANT_ID] })).resolves.toEqual({
      status: "disabled",
    });
    expect(prisma.mcpGrant.findMany).not.toHaveBeenCalled();
  });

  test("does nothing for an empty target list", async () => {
    await expect(reconcileMcpGrantRelationships({})).resolves.toEqual({ passes: 0, status: "projected" });
    expect(prisma.mcpGrant.findMany).not.toHaveBeenCalled();
    expect(clientMocks.writeRelationships).not.toHaveBeenCalled();
  });

  test("touches the selected workspaces and deletes what SpiceDB holds beyond them, in one write", async () => {
    vi.mocked(prisma.mcpGrant.findMany).mockResolvedValue([
      grantRow({ access: "workspaces", workspaces: ["ws-keep", "ws-new"] }),
    ] as never);
    observe({
      organization: [relationship("organization", "org-left-over")],
      workspace: [relationship("workspace", "ws-keep"), relationship("workspace", "ws-removed")],
    });

    await expect(reconcileMcpGrantRelationships({ grantIds: [GRANT_ID, GRANT_ID] })).resolves.toEqual({
      passes: 1,
      status: "projected",
    });

    // Narrowing and widening land atomically: one batch carries both the touches and the deletes.
    expect(clientMocks.writeRelationships).toHaveBeenCalledTimes(1);
    expect(writtenUpdates()).toEqual([
      { operation: "touch", relationship: relationship("workspace", "ws-keep") },
      { operation: "touch", relationship: relationship("workspace", "ws-new") },
      { operation: "delete", relationship: relationship("organization", "org-left-over") },
      { operation: "delete", relationship: relationship("workspace", "ws-removed") },
    ]);
    // Deduplicated ids: one grant read, one row each for organization and workspace.
    expect(prisma.mcpGrant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [GRANT_ID] } } })
    );
    expect(readAllRelationships).toHaveBeenCalledTimes(2);
  });

  // That a reconcile racing a narrowing waits for it and leaves the narrowed relationships is a database
  // behaviour, checked on real Postgres and SpiceDB in `mcp-workspace-access.integration.test.ts`.

  test("deletes every observed relationship of a grant that no longer exists", async () => {
    vi.mocked(prisma.mcpGrant.findMany).mockResolvedValue([] as never);
    observe({ organization: [relationship("organization", "org-1")] });

    await expect(reconcileMcpGrantRelationships({ grantIds: [GRANT_ID] })).resolves.toEqual({
      passes: 1,
      status: "projected",
    });
    expect(writtenUpdates()).toEqual([
      { operation: "delete", relationship: relationship("organization", "org-1") },
    ]);
  });

  test("deletes the old selection of a grant switched to All access, ignoring a stray row", async () => {
    vi.mocked(prisma.mcpGrant.findMany).mockResolvedValue([
      grantRow({ access: "all", workspaces: ["ws-stray-row"] }),
    ] as never);
    observe({ workspace: [relationship("workspace", "ws-stray-row")] });

    await reconcileMcpGrantRelationships({ grantIds: [GRANT_ID] });

    expect(writtenUpdates()).toEqual([
      { operation: "delete", relationship: relationship("workspace", "ws-stray-row") },
    ]);
  });

  test("observes grants in bounded parallel pages and sorts the ids", async () => {
    const grantIds = Array.from(
      { length: AUTHZED_MAX_PARALLEL_RELATIONSHIP_DELETES + 1 },
      (_, index) => `grant-${String(index).padStart(2, "0")}`
    ).reverse();
    vi.mocked(prisma.mcpGrant.findMany).mockResolvedValue(
      grantIds.map((id) => grantRow({ access: "organizations", id, organizations: [`org-${id}`] })) as never
    );

    await reconcileMcpGrantRelationships({ grantIds });

    // Two resource types per grant, every grant observed exactly once.
    expect(readAllRelationships).toHaveBeenCalledTimes(grantIds.length * 2);
    expect(vi.mocked(prisma.mcpGrant.findMany).mock.calls[0][0]).toMatchObject({
      where: { id: { in: [...grantIds].sort() } },
    });
    expect(
      writtenUpdates().map(({ operation, relationship: { resource } }) => [operation, resource.objectId])
    ).toEqual([...grantIds].sort().map((id) => ["touch", `org-${id}`]));
  });

  test("runs another pass when the rows changed under the write, and stops once they hold still", async () => {
    vi.mocked(prisma.mcpGrant.findMany)
      .mockResolvedValueOnce([grantRow({ workspaces: ["ws-1"] })] as never)
      .mockResolvedValueOnce([grantRow({ workspaces: ["ws-2"] })] as never)
      .mockResolvedValueOnce([grantRow({ workspaces: ["ws-2"] })] as never)
      .mockResolvedValueOnce([grantRow({ workspaces: ["ws-2"] })] as never);

    await expect(reconcileMcpGrantRelationships({ grantIds: [GRANT_ID] })).resolves.toEqual({
      passes: 2,
      status: "projected",
    });
    expect(clientMocks.writeRelationships).toHaveBeenCalledTimes(2);
  });

  test("fails as unstable when the rows never hold still", async () => {
    let call = 0;
    vi.mocked(prisma.mcpGrant.findMany).mockImplementation((() =>
      Promise.resolve([grantRow({ workspaces: [`ws-${call++}`] })])) as never);

    await expect(reconcileMcpGrantRelationships({ grantIds: [GRANT_ID] })).resolves.toMatchObject({
      code: "authzed_projection_unstable",
      status: "failed",
    });
  });

  test("carries on without failing when the schema predates mcp_grant", async () => {
    vi.mocked(prisma.mcpGrant.findMany).mockResolvedValue([grantRow({ workspaces: ["ws-1"] })] as never);
    clientMocks.writeRelationships.mockRejectedValue(schemaMissingMcpGrant());

    await expect(reconcileMcpGrantRelationships({ grantIds: [GRANT_ID] })).resolves.toEqual({
      passes: 1,
      status: "projected",
    });
    expect(logger.warn).toHaveBeenCalledWith(
      { grants: 1, relation: "mcp_grant" },
      expect.stringContaining("predates MCP grants")
    );
  });

  test("fails the projection on any other write error", async () => {
    vi.mocked(prisma.mcpGrant.findMany).mockResolvedValue([grantRow({ workspaces: ["ws-1"] })] as never);
    clientMocks.writeRelationships.mockRejectedValue(
      new AuthzedError({
        attempts: 3,
        code: AUTHZED_ERROR_CODES.UNAVAILABLE,
        operation: "write_relationships",
        retryable: true,
      })
    );

    await expect(reconcileMcpGrantRelationships({ grantIds: [GRANT_ID] })).resolves.toMatchObject({
      code: AUTHZED_ERROR_CODES.UNAVAILABLE,
      status: "failed",
    });
    expect(logger.warn).not.toHaveBeenCalledWith(expect.anything(), expect.stringContaining("predates"));
  });
});

describe("deleteMcpGrantRelationshipsBeforeCommit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAuthzedEnabled).mockReturnValue(true);
    vi.mocked(getAuthzedClient).mockReturnValue(
      clientMocks as unknown as ReturnType<typeof getAuthzedClient>
    );
    clientMocks.writeRelationships.mockResolvedValue(undefined);
    vi.mocked(queueAuthzedOutboxEvents).mockResolvedValue(undefined);
  });

  test("queues the grant's repair before it deletes, so a process exit before the commit leaves one", async () => {
    const steps: string[] = [];
    vi.mocked(queueAuthzedOutboxEvents).mockImplementation(async (targetType, ids) => {
      steps.push(`queued ${targetType} ${ids.join(",")}`);
    });
    clientMocks.writeRelationships.mockImplementation(async () => {
      steps.push("deleted");
    });

    await deleteMcpGrantRelationshipsBeforeCommit(workspaces("ws-1"), { access: "all" });

    expect(steps).toEqual([`queued mcp_grant ${GRANT_ID}`, "deleted"]);
  });

  test("deletes nothing when the repair can't be queued", async () => {
    const outage = new Error("database unavailable");
    vi.mocked(queueAuthzedOutboxEvents).mockRejectedValue(outage);

    await expect(deleteMcpGrantRelationshipsBeforeCommit(workspaces("ws-1"), { access: "all" })).rejects.toBe(
      outage
    );
    expect(clientMocks.writeRelationships).not.toHaveBeenCalled();
  });

  test("deletes only what the narrowing drops, and never touches anything", async () => {
    await deleteMcpGrantRelationshipsBeforeCommit(workspaces("ws-keep", "ws-drop"), {
      access: "workspaces",
      workspaceIds: ["ws-keep", "ws-add"],
    });

    expect(writtenUpdates()).toEqual([
      { operation: "delete", relationship: relationship("workspace", "ws-drop") },
    ]);
  });

  test("deletes the old selection when the mode changes", async () => {
    await deleteMcpGrantRelationshipsBeforeCommit(
      { id: GRANT_ID, access: "organizations", organizationIds: ["org-1"] },
      { access: "workspaces", workspaceIds: ["ws-1"] }
    );

    expect(writtenUpdates()).toEqual([
      { operation: "delete", relationship: relationship("organization", "org-1") },
    ]);
  });

  test("writes nothing for a widening or a grant that was All access", async () => {
    await deleteMcpGrantRelationshipsBeforeCommit(workspaces("ws-1"), {
      access: "workspaces",
      workspaceIds: ["ws-1", "ws-2"],
    });
    await deleteMcpGrantRelationshipsBeforeCommit(
      { id: GRANT_ID, access: "all" },
      {
        access: "workspaces",
        workspaceIds: ["ws-1"],
      }
    );

    expect(clientMocks.writeRelationships).not.toHaveBeenCalled();
    expect(queueAuthzedOutboxEvents).not.toHaveBeenCalled();
  });

  test("does nothing with AuthZed off", async () => {
    vi.mocked(isAuthzedEnabled).mockReturnValue(false);

    await deleteMcpGrantRelationshipsBeforeCommit(workspaces("ws-1"), { access: "all" });

    expect(getAuthzedClient).not.toHaveBeenCalled();
  });

  test("throws a SpiceDB failure so the caller's transaction rolls back", async () => {
    const outage = new AuthzedError({
      attempts: 3,
      code: AUTHZED_ERROR_CODES.UNAVAILABLE,
      operation: "write_relationships",
      retryable: true,
    });
    clientMocks.writeRelationships.mockRejectedValue(outage);

    await expect(deleteMcpGrantRelationshipsBeforeCommit(workspaces("ws-1"), { access: "all" })).rejects.toBe(
      outage
    );
  });

  test("tolerates the previous release's schema, which never held these relationships", async () => {
    clientMocks.writeRelationships.mockRejectedValue(schemaMissingMcpGrant());

    await expect(
      deleteMcpGrantRelationshipsBeforeCommit(workspaces("ws-1"), { access: "all" })
    ).resolves.toBeUndefined();
  });
});

describe("removeDeletedMcpGrantRelationships", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAuthzedEnabled).mockReturnValue(true);
    vi.mocked(getAuthzedClient).mockReturnValue(
      clientMocks as unknown as ReturnType<typeof getAuthzedClient>
    );
    clientMocks.writeRelationships.mockResolvedValue(undefined);
  });

  test("deletes every relationship the deleted grants' access implied, in one write", async () => {
    await expect(
      removeDeletedMcpGrantRelationships([
        { id: GRANT_ID, access: "organizations", organizationIds: ["org-1", "org-2"] },
        { id: "grant-b", access: "all" },
        { id: "grant-c", access: "workspaces", workspaceIds: ["ws-1"] },
      ])
    ).resolves.toEqual({ passes: 1, status: "projected" });

    expect(clientMocks.writeRelationships).toHaveBeenCalledTimes(1);
    expect(writtenUpdates()).toEqual([
      { operation: "delete", relationship: relationship("organization", "org-1") },
      { operation: "delete", relationship: relationship("organization", "org-2") },
      { operation: "delete", relationship: relationship("workspace", "ws-1", "grant-c") },
    ]);
  });

  test("reports a SpiceDB failure instead of throwing: the deleted rows already ended the access", async () => {
    clientMocks.writeRelationships.mockRejectedValue(
      new AuthzedError({
        attempts: 3,
        code: AUTHZED_ERROR_CODES.UNAVAILABLE,
        operation: "write_relationships",
        retryable: true,
      })
    );

    await expect(
      removeDeletedMcpGrantRelationships([{ id: GRANT_ID, access: "workspaces", workspaceIds: ["ws-1"] }])
    ).resolves.toMatchObject({ status: "failed", code: AUTHZED_ERROR_CODES.UNAVAILABLE });
  });

  test("writes nothing for grants that selected nothing", async () => {
    await removeDeletedMcpGrantRelationships([{ id: GRANT_ID, access: "all" }]);

    expect(clientMocks.writeRelationships).not.toHaveBeenCalled();
  });
});
