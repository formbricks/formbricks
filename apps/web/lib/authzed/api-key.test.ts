import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { reconcileApiKeyRelationships } from "./api-key";
import { type TAuthzedRelationshipUpdate, getAuthzedClient } from "./client";
import { isAuthzedEnabled } from "./config";
import { AUTHZED_MAX_PARALLEL_RELATIONSHIP_DELETES } from "./constants";
import { AUTHZED_ERROR_CODES, AuthzedError } from "./errors";

const clientMocks = {
  deleteRelationships: vi.fn(),
  writeRelationships: vi.fn(),
};

vi.mock("@formbricks/database", () => ({
  prisma: {
    apiKey: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("./client", () => ({
  getAuthzedClient: vi.fn(),
}));

vi.mock("./config", () => ({
  isAuthzedEnabled: vi.fn(),
}));

const API_KEY_ID = "api-key-private-id";
const ORGANIZATION_ID = "organization-private-id";
const WORKSPACE_ID = "workspace-private-id";

const createSnapshot = ({
  apiKeyId = API_KEY_ID,
  organizationAccess = {
    accessControl: {
      read: false,
      write: false,
    },
  },
  permission = "read",
  workspaceId = WORKSPACE_ID,
}: Readonly<{
  apiKeyId?: string;
  organizationAccess?: unknown;
  permission?: "manage" | "read" | "write" | null;
  workspaceId?: string;
}> = {}) => ({
  apiKeyWorkspaces:
    permission === null
      ? []
      : [
          {
            permission,
            workspaceId,
          },
        ],
  id: apiKeyId,
  organizationAccess,
  organizationId: ORGANIZATION_ID,
});

const setStableSnapshot = (
  options: Parameters<typeof createSnapshot>[0] = {}
): ReturnType<typeof createSnapshot> => {
  const snapshot = createSnapshot(options);
  vi.mocked(prisma.apiKey.findMany).mockResolvedValue([snapshot] as never);
  return snapshot;
};

describe("API key relationship projection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAuthzedEnabled).mockReturnValue(true);
    vi.mocked(getAuthzedClient).mockReturnValue(
      clientMocks as unknown as ReturnType<typeof getAuthzedClient>
    );
    clientMocks.deleteRelationships.mockResolvedValue(undefined);
    clientMocks.writeRelationships.mockResolvedValue(undefined);
    setStableSnapshot();
  });

  test("reads only authorization-bearing API key fields", async () => {
    await reconcileApiKeyRelationships({ apiKeyIds: [API_KEY_ID] });

    expect(prisma.apiKey.findMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: [API_KEY_ID],
        },
      },
      select: {
        apiKeyWorkspaces: {
          select: {
            permission: true,
            workspaceId: true,
          },
          orderBy: {
            workspaceId: "asc",
          },
        },
        id: true,
        organizationAccess: true,
        organizationId: true,
      },
      orderBy: {
        id: "asc",
      },
    });

    const serializedQuery = JSON.stringify(vi.mocked(prisma.apiKey.findMany).mock.calls[0]);
    expect(serializedQuery).not.toContain("hashedKey");
    expect(serializedQuery).not.toContain("lookupHash");
    expect(serializedQuery).not.toContain("lastUsedAt");
    expect(serializedQuery).not.toContain("createdBy");
  });

  test("projects the API key organization parent", async () => {
    await reconcileApiKeyRelationships({ apiKeyIds: [API_KEY_ID] });

    expect(clientMocks.writeRelationships.mock.calls.flatMap(([batch]) => batch)).toContainEqual({
      operation: "touch",
      relationship: {
        relation: "organization",
        resource: { objectId: API_KEY_ID, objectType: "api_key" },
        subject: { objectId: ORGANIZATION_ID, objectType: "organization" },
      },
    });
  });

  test("removes every previous parent and organization access edge before restoring current access", async () => {
    setStableSnapshot({
      organizationAccess: { accessControl: { read: true, write: false } },
    });

    await reconcileApiKeyRelationships({ apiKeyIds: [API_KEY_ID] });

    expect(clientMocks.deleteRelationships).toHaveBeenCalledWith({
      relation: "organization",
      resourceId: API_KEY_ID,
      resourceType: "api_key",
    });
    expect(clientMocks.deleteRelationships).toHaveBeenCalledWith({
      relation: "api_key_reader",
      resourceType: "organization",
      subject: { objectId: API_KEY_ID, objectType: "api_key" },
    });
    expect(clientMocks.deleteRelationships).toHaveBeenCalledWith({
      relation: "api_key_writer",
      resourceType: "organization",
      subject: { objectId: API_KEY_ID, objectType: "api_key" },
    });
    expect(Math.max(...clientMocks.deleteRelationships.mock.invocationCallOrder)).toBeLessThan(
      clientMocks.writeRelationships.mock.invocationCallOrder[0]
    );
  });

  test.each([
    [false, false, []],
    [true, false, ["api_key_reader"]],
    [false, true, ["api_key_writer"]],
    [true, true, ["api_key_reader", "api_key_writer"]],
  ] as const)(
    "projects organization access read=%s write=%s independently",
    async (read, write, touchedRelations) => {
      setStableSnapshot({
        organizationAccess: {
          accessControl: {
            read,
            write,
          },
        },
      });

      await reconcileApiKeyRelationships({ apiKeyIds: [API_KEY_ID] });

      const organizationUpdates = clientMocks.writeRelationships.mock.calls
        .flatMap(([batch]) => batch)
        .filter(({ relationship }) => relationship.resource.objectType === "organization");
      expect(organizationUpdates).toHaveLength(2);
      expect(
        organizationUpdates
          .filter(({ operation }) => operation === "touch")
          .map(({ relationship }) => relationship.relation)
      ).toEqual(touchedRelations);
      expect(organizationUpdates.filter(({ operation }) => operation === "delete")).toHaveLength(
        2 - touchedRelations.length
      );
    }
  );

  test.each([
    undefined,
    null,
    [],
    {},
    { accessControl: null },
    { accessControl: { read: "true", write: 1 } },
  ])("treats malformed organization access as no access", async (organizationAccess) => {
    setStableSnapshot({ organizationAccess });

    await reconcileApiKeyRelationships({ apiKeyIds: [API_KEY_ID] });

    const organizationUpdates = clientMocks.writeRelationships.mock.calls
      .flatMap(([batch]) => batch)
      .filter(({ relationship }) => relationship.resource.objectType === "organization");
    expect(organizationUpdates).toHaveLength(2);
    expect(organizationUpdates.every(({ operation }) => operation === "delete")).toBe(true);
  });

  test.each([
    ["read", "reader"],
    ["write", "writer"],
    ["manage", "manager"],
  ] as const)(
    "projects a %s workspace scope and deletes its alternate grants",
    async (permission, relation) => {
      setStableSnapshot({ permission });

      await reconcileApiKeyRelationships({ apiKeyIds: [API_KEY_ID] });

      const workspaceUpdates = clientMocks.writeRelationships.mock.calls
        .flatMap(([batch]) => batch)
        .filter(({ relationship }) => relationship.resource.objectType === "workspace");
      expect(workspaceUpdates).toHaveLength(3);
      expect(workspaceUpdates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            operation: "touch",
            relationship: expect.objectContaining({
              relation,
              subject: { objectId: API_KEY_ID, objectType: "api_key" },
            }),
          }),
        ])
      );
      expect(workspaceUpdates.filter(({ operation }) => operation === "delete")).toHaveLength(2);
    }
  );

  test("projects multiple workspace scopes independently", async () => {
    vi.mocked(prisma.apiKey.findMany).mockResolvedValue([
      {
        ...createSnapshot({ permission: null }),
        apiKeyWorkspaces: [
          { permission: "read", workspaceId: "workspace-a" },
          { permission: "manage", workspaceId: "workspace-b" },
        ],
      },
    ] as never);

    await reconcileApiKeyRelationships({ apiKeyIds: [API_KEY_ID] });

    const touchedWorkspaceRelations = clientMocks.writeRelationships.mock.calls
      .flatMap(([batch]) => batch)
      .filter(
        ({ operation, relationship }) =>
          operation === "touch" && relationship.resource.objectType === "workspace"
      )
      .map(({ relationship }) => relationship.relation);
    expect(touchedWorkspaceRelations).toEqual(["reader", "manager"]);
  });

  test("deletes a workspace scope observed before a concurrent source removal", async () => {
    const withScope = createSnapshot({ permission: "manage" });
    const withoutScope = createSnapshot({ permission: null });
    vi.mocked(prisma.apiKey.findMany)
      .mockResolvedValueOnce([withScope] as never)
      .mockResolvedValueOnce([withoutScope] as never)
      .mockResolvedValueOnce([withoutScope] as never)
      .mockResolvedValueOnce([withoutScope] as never);

    await expect(reconcileApiKeyRelationships({ apiKeyIds: [API_KEY_ID] })).resolves.toEqual({
      passes: 2,
      status: "projected",
    });

    const secondPassUpdates = clientMocks.writeRelationships.mock
      .calls[1][0] as ReadonlyArray<TAuthzedRelationshipUpdate>;
    const workspaceUpdates = secondPassUpdates.filter(
      ({ relationship }) => relationship.resource.objectType === "workspace"
    );
    expect(workspaceUpdates).toHaveLength(3);
    expect(workspaceUpdates.every(({ operation }) => operation === "delete")).toBe(true);
  });

  test("reconciles a complete snapshot again when organization access changes concurrently", async () => {
    const reader = createSnapshot({
      organizationAccess: { accessControl: { read: true, write: false } },
    });
    const writer = createSnapshot({
      organizationAccess: { accessControl: { read: false, write: true } },
    });
    vi.mocked(prisma.apiKey.findMany)
      .mockResolvedValueOnce([reader] as never)
      .mockResolvedValueOnce([writer] as never)
      .mockResolvedValueOnce([writer] as never)
      .mockResolvedValueOnce([writer] as never);

    await expect(reconcileApiKeyRelationships({ apiKeyIds: [API_KEY_ID] })).resolves.toEqual({
      passes: 2,
      status: "projected",
    });

    expect(clientMocks.writeRelationships).toHaveBeenCalledTimes(2);
  });

  test("converges when a missing API key is recreated during reconciliation", async () => {
    const recreatedApiKey = createSnapshot({
      organizationAccess: { accessControl: { read: true, write: false } },
      permission: "write",
    });
    vi.mocked(prisma.apiKey.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([recreatedApiKey] as never)
      .mockResolvedValueOnce([recreatedApiKey] as never)
      .mockResolvedValueOnce([recreatedApiKey] as never);

    await expect(reconcileApiKeyRelationships({ apiKeyIds: [API_KEY_ID] })).resolves.toEqual({
      passes: 2,
      status: "projected",
    });

    expect(clientMocks.deleteRelationships).toHaveBeenCalledTimes(6);
    expect(clientMocks.writeRelationships).toHaveBeenCalledTimes(1);
    expect(clientMocks.writeRelationships.mock.calls[0][0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: "touch",
          relationship: expect.objectContaining({ relation: "api_key_reader" }),
        }),
        expect.objectContaining({
          operation: "touch",
          relationship: expect.objectContaining({ relation: "writer" }),
        }),
      ])
    );
  });

  test("returns a stable failure after three changing snapshots", async () => {
    const reader = createSnapshot({
      organizationAccess: { accessControl: { read: true, write: false } },
    });
    const writer = createSnapshot({
      organizationAccess: { accessControl: { read: false, write: true } },
    });
    vi.mocked(prisma.apiKey.findMany)
      .mockResolvedValueOnce([reader] as never)
      .mockResolvedValueOnce([writer] as never)
      .mockResolvedValueOnce([reader] as never)
      .mockResolvedValueOnce([writer] as never)
      .mockResolvedValueOnce([reader] as never)
      .mockResolvedValueOnce([writer] as never);

    await expect(reconcileApiKeyRelationships({ apiKeyIds: [API_KEY_ID] })).resolves.toEqual({
      attempts: 3,
      code: "authzed_projection_unstable",
      retryable: false,
      status: "failed",
    });
  });

  test("deduplicates and deterministically orders API key targets", async () => {
    const secondApiKeyId = "another-api-key";
    vi.mocked(prisma.apiKey.findMany).mockResolvedValue([
      createSnapshot({ apiKeyId: secondApiKeyId }),
      createSnapshot(),
    ] as never);

    await reconcileApiKeyRelationships({
      apiKeyIds: [API_KEY_ID, secondApiKeyId, API_KEY_ID],
    });

    expect(prisma.apiKey.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: {
            in: [secondApiKeyId, API_KEY_ID],
          },
        },
      })
    );
  });

  test("packs at most 1,000 updates without splitting an organization access pair", async () => {
    const apiKeys = Array.from({ length: 334 }, (_, index) =>
      createSnapshot({ apiKeyId: `api-key-${index}`, permission: null })
    );
    vi.mocked(prisma.apiKey.findMany).mockResolvedValue(apiKeys as never);

    await reconcileApiKeyRelationships({ apiKeyIds: apiKeys.map(({ id }) => id) });

    expect(clientMocks.writeRelationships).toHaveBeenCalledTimes(2);
    expect(clientMocks.writeRelationships.mock.calls[0][0]).toHaveLength(1_000);
    expect(clientMocks.writeRelationships.mock.calls[1][0]).toHaveLength(2);
    const finalBatch = clientMocks.writeRelationships.mock
      .calls[1][0] as ReadonlyArray<TAuthzedRelationshipUpdate>;
    expect(finalBatch.every(({ relationship }) => relationship.resource.objectType === "organization")).toBe(
      true
    );
  });

  test("cleans every resource and subject relationship for a missing API key", async () => {
    vi.mocked(prisma.apiKey.findMany).mockResolvedValue([]);

    await reconcileApiKeyRelationships({ apiKeyIds: [API_KEY_ID] });

    expect(clientMocks.deleteRelationships).toHaveBeenNthCalledWith(1, {
      resourceId: API_KEY_ID,
      resourceType: "api_key",
    });
    expect(clientMocks.deleteRelationships).toHaveBeenNthCalledWith(2, {
      resourceType: "organization",
      subject: { objectId: API_KEY_ID, objectType: "api_key" },
    });
    expect(clientMocks.deleteRelationships).toHaveBeenNthCalledWith(3, {
      resourceType: "workspace",
      subject: { objectId: API_KEY_ID, objectType: "api_key" },
    });
  });

  test("bounds parallel relationship deletion for large API key cascades", async () => {
    const missingApiKeyIds = Array.from({ length: 12 }, (_, index) => `missing-api-key-${index}`);
    let activeDeletes = 0;
    let maxActiveDeletes = 0;
    vi.mocked(prisma.apiKey.findMany).mockResolvedValue([]);
    clientMocks.deleteRelationships.mockImplementation(async () => {
      activeDeletes++;
      maxActiveDeletes = Math.max(maxActiveDeletes, activeDeletes);
      await Promise.resolve();
      activeDeletes--;
    });

    await reconcileApiKeyRelationships({ apiKeyIds: missingApiKeyIds });

    expect(clientMocks.deleteRelationships).toHaveBeenCalledTimes(missingApiKeyIds.length * 3);
    expect(maxActiveDeletes).toBe(AUTHZED_MAX_PARALLEL_RELATIONSHIP_DELETES);
  });

  test("returns disabled before reading PostgreSQL or constructing a client", async () => {
    vi.mocked(isAuthzedEnabled).mockReturnValue(false);

    await expect(reconcileApiKeyRelationships({ apiKeyIds: [API_KEY_ID] })).resolves.toEqual({
      status: "disabled",
    });

    expect(prisma.apiKey.findMany).not.toHaveBeenCalled();
    expect(getAuthzedClient).not.toHaveBeenCalled();
  });

  test("treats an empty target set as a zero-pass no-op without constructing a client", async () => {
    await expect(reconcileApiKeyRelationships({})).resolves.toEqual({
      passes: 0,
      status: "projected",
    });

    expect(prisma.apiKey.findMany).not.toHaveBeenCalled();
    expect(getAuthzedClient).not.toHaveBeenCalled();
  });

  test("contains operational failures with sanitized logs and results", async () => {
    clientMocks.writeRelationships.mockRejectedValue(
      new AuthzedError({
        attempts: 3,
        cause: new Error("raw-sdk-message-with-private-api-key"),
        code: AUTHZED_ERROR_CODES.UNAVAILABLE,
        operation: "write_relationships",
        retryable: true,
      })
    );

    await expect(reconcileApiKeyRelationships({ apiKeyIds: [API_KEY_ID] })).resolves.toEqual({
      attempts: 3,
      code: AUTHZED_ERROR_CODES.UNAVAILABLE,
      retryable: true,
      status: "failed",
    });

    const serializedLog = JSON.stringify(vi.mocked(logger.warn).mock.calls[0]);
    expect(serializedLog).not.toContain(API_KEY_ID);
    expect(serializedLog).not.toContain(ORGANIZATION_ID);
    expect(serializedLog).not.toContain(WORKSPACE_ID);
    expect(serializedLog).not.toContain("private-api-key");
    expect(serializedLog).not.toContain("raw-sdk-message");
  });

  describe("explicitly named workspace scopes", () => {
    const workspaceUpdatesFor = (workspaceId: string) =>
      clientMocks.writeRelationships.mock.calls
        .flatMap(([updates]) => updates)
        .filter(
          ({ relationship }) =>
            relationship.resource.objectType === "workspace" && relationship.resource.objectId === workspaceId
        );

    test("deletes a scope the source no longer grants", async () => {
      // A revoked scope is absent from the snapshot, so without being named nothing would target it
      // and the stale relationship would survive indefinitely.
      setStableSnapshot({ permission: null });

      await expect(
        reconcileApiKeyRelationships({
          apiKeyIds: [API_KEY_ID],
          apiKeyWorkspaceGrants: [{ apiKeyId: API_KEY_ID, workspaceId: "revoked-workspace" }],
        })
      ).resolves.toEqual({ passes: 1, status: "projected" });

      const updates = workspaceUpdatesFor("revoked-workspace");
      expect(updates).toHaveLength(3);
      expect(updates.every(({ operation }) => operation === "delete")).toBe(true);
    });

    test("still touches the granted permission when the source does hold the scope", async () => {
      setStableSnapshot({ permission: "write", workspaceId: "granted-workspace" });

      await reconcileApiKeyRelationships({
        apiKeyIds: [API_KEY_ID],
        apiKeyWorkspaceGrants: [{ apiKeyId: API_KEY_ID, workspaceId: "granted-workspace" }],
      });

      // Naming a target must not force a delete: the decision still comes from the source snapshot.
      const updates = workspaceUpdatesFor("granted-workspace");
      expect(updates).toHaveLength(3);
      expect(updates.filter(({ operation }) => operation === "touch")).toHaveLength(1);
      expect(updates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            operation: "touch",
            relationship: expect.objectContaining({ relation: "writer" }),
          }),
        ])
      );
    });

    test("implies the API key so a caller repairing one scope need not also name the key", async () => {
      setStableSnapshot({ permission: null });

      await reconcileApiKeyRelationships({
        apiKeyWorkspaceGrants: [{ apiKeyId: API_KEY_ID, workspaceId: "revoked-workspace" }],
      });

      expect(prisma.apiKey.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: [API_KEY_ID] } } })
      );
      expect(workspaceUpdatesFor("revoked-workspace")).toHaveLength(3);
    });

    test("reconciles both a named scope and one discovered from the source", async () => {
      setStableSnapshot({ permission: "read", workspaceId: "granted-workspace" });

      await reconcileApiKeyRelationships({
        apiKeyWorkspaceGrants: [{ apiKeyId: API_KEY_ID, workspaceId: "revoked-workspace" }],
      });

      expect(workspaceUpdatesFor("granted-workspace")).toHaveLength(3);
      expect(workspaceUpdatesFor("revoked-workspace")).toHaveLength(3);
    });
  });
});
