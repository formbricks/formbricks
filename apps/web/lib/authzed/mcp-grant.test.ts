import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
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
import { readAllRelationships } from "./relationship-reads";

const clientMocks = { writeRelationships: vi.fn() };

vi.mock("@formbricks/database", () => ({
  prisma: { mcpGrant: { findMany: vi.fn() }, $queryRaw: vi.fn(), $transaction: vi.fn() },
}));

vi.mock("@formbricks/logger", () => ({
  logger: { debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock("./client", () => ({ getAuthzedClient: vi.fn() }));
vi.mock("./config", () => ({ isAuthzedEnabled: vi.fn() }));
vi.mock("./relationship-reads", () => ({ readAllRelationships: vi.fn() }));

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

  // A narrowing holds its grant's row `FOR UPDATE` while it deletes from SpiceDB: a pass that read the
  // grant before it must not write the old relationships back after it.
  test("reads and writes each pass inside a transaction that holds the grants' rows FOR SHARE", async () => {
    const order: string[] = [];
    vi.mocked(prisma.$queryRaw).mockImplementation((async (strings: TemplateStringsArray) => {
      order.push(strings.join("?").includes("FOR SHARE") ? "lock" : "other");
      return [];
    }) as never);
    vi.mocked(prisma.mcpGrant.findMany).mockImplementation((async () => {
      order.push("read");
      return [grantRow({ workspaces: ["ws-1"] })];
    }) as never);
    clientMocks.writeRelationships.mockImplementation(async () => {
      order.push("write");
    });

    await reconcileMcpGrantRelationships({ grantIds: ["grant-b", GRANT_ID] });

    expect(order).toEqual(["lock", "read", "write", "lock", "read"]);
    const [lock] = vi.mocked(prisma.$queryRaw).mock.calls[0] as unknown as [TemplateStringsArray, string[]];
    expect(lock.join("?")).toMatch(/ORDER BY "id" FOR SHARE/);
    expect(vi.mocked(prisma.$queryRaw).mock.calls[0][1]).toEqual([GRANT_ID, "grant-b"]);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 10_000,
      timeout: 30_000,
    });
  });

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
