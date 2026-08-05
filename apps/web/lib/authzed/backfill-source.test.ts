import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import type { TAuthzedSourceRef } from "./backfill-diff";
import {
  findMismatchedParentEdges,
  findMissingSourceRefs,
  organizationExists,
  readOrganizationIdPage,
  readOrganizationSource,
  readWorkspaceSource,
} from "./backfill-source";
import { AUTHZED_BACKFILL_ORGANIZATION_PAGE_SIZE, AUTHZED_BACKFILL_TARGET_CHUNK_SIZE } from "./constants";

vi.mock("@formbricks/database", () => ({
  prisma: {
    apiKey: { findMany: vi.fn() },
    apiKeyWorkspace: { findMany: vi.fn() },
    membership: { findMany: vi.fn() },
    organization: { count: vi.fn(), findMany: vi.fn() },
    team: { findMany: vi.fn() },
    teamUser: { findMany: vi.fn() },
    workspace: { findMany: vi.fn(), findUnique: vi.fn() },
    workspaceTeam: { findMany: vi.fn() },
  },
}));

const ORGANIZATION_ID = "org-1";

const setEmptySource = (): void => {
  vi.mocked(prisma.membership.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.team.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.workspace.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null as never);
  vi.mocked(prisma.apiKey.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.teamUser.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.workspaceTeam.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.apiKeyWorkspace.findMany).mockResolvedValue([] as never);
};

beforeEach(() => {
  vi.clearAllMocks();
  setEmptySource();
});

describe("readOrganizationIdPage", () => {
  test("reads the first page without a cursor, ordered so the sweep is stable", async () => {
    vi.mocked(prisma.organization.findMany).mockResolvedValue([{ id: "org-1" }, { id: "org-2" }] as never);

    await expect(readOrganizationIdPage()).resolves.toEqual(["org-1", "org-2"]);
    expect(prisma.organization.findMany).toHaveBeenCalledWith({
      where: undefined,
      select: { id: true },
      orderBy: { id: "asc" },
      take: AUTHZED_BACKFILL_ORGANIZATION_PAGE_SIZE,
    });
  });

  test("resumes strictly after the supplied cursor so no organization is repeated or skipped", async () => {
    vi.mocked(prisma.organization.findMany).mockResolvedValue([{ id: "org-3" }] as never);

    await readOrganizationIdPage({ afterOrganizationId: "org-2", limit: 10 });

    expect(prisma.organization.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, where: { id: { gt: "org-2" } } })
    );
  });

  test("propagates a read failure rather than reporting an empty page", async () => {
    vi.mocked(prisma.organization.findMany).mockRejectedValue(new Error("connection reset"));

    await expect(readOrganizationIdPage()).rejects.toThrow("connection reset");
  });
});

describe("organizationExists", () => {
  test.each([
    [1, true],
    [0, false],
  ])("reports %i matching rows as %s", async (count, expected) => {
    vi.mocked(prisma.organization.count).mockResolvedValue(count as never);

    await expect(organizationExists(ORGANIZATION_ID)).resolves.toBe(expected);
  });
});

describe("readOrganizationSource", () => {
  test("scopes every query to the organization and reads only authorization-bearing columns", async () => {
    await readOrganizationSource(ORGANIZATION_ID);

    expect(prisma.membership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ select: { userId: true }, where: { organizationId: ORGANIZATION_ID } })
    );
    expect(prisma.teamUser.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { team: { organizationId: ORGANIZATION_ID } } })
    );
    expect(prisma.apiKeyWorkspace.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { apiKey: { organizationId: ORGANIZATION_ID } } })
    );

    // The README commits to never reading key material or usage metadata.
    const allQueries = JSON.stringify([
      vi.mocked(prisma.apiKey.findMany).mock.calls,
      vi.mocked(prisma.apiKeyWorkspace.findMany).mock.calls,
    ]);
    for (const forbidden of ["hashedKey", "lookupHash", "lastUsedAt", "createdBy"]) {
      expect(allQueries).not.toContain(forbidden);
    }
  });

  test("collects every target kind owned by the organization", async () => {
    vi.mocked(prisma.membership.findMany).mockResolvedValue([{ userId: "user-1" }] as never);
    vi.mocked(prisma.team.findMany).mockResolvedValue([{ id: "team-1" }] as never);
    vi.mocked(prisma.workspace.findMany).mockResolvedValue([{ id: "ws-1" }] as never);
    vi.mocked(prisma.apiKey.findMany).mockResolvedValue([{ id: "key-1" }] as never);
    vi.mocked(prisma.teamUser.findMany).mockResolvedValue([{ teamId: "team-1", userId: "user-1" }] as never);
    vi.mocked(prisma.workspaceTeam.findMany).mockResolvedValue([
      { team: { organizationId: ORGANIZATION_ID }, teamId: "team-1", workspaceId: "ws-1" },
    ] as never);
    vi.mocked(prisma.apiKeyWorkspace.findMany).mockResolvedValue([
      { apiKeyId: "key-1", workspace: { organizationId: ORGANIZATION_ID }, workspaceId: "ws-1" },
    ] as never);

    await expect(readOrganizationSource(ORGANIZATION_ID)).resolves.toEqual({
      apiKeyIds: ["key-1"],
      apiKeyWorkspaceGrants: [{ apiKeyId: "key-1", workspaceId: "ws-1" }],
      invalidApiKeyWorkspaceGrants: [],
      invalidWorkspaceTeamGrants: [],
      memberships: [{ organizationId: ORGANIZATION_ID, userId: "user-1" }],
      teamIds: ["team-1"],
      teamMemberships: [{ teamId: "team-1", userId: "user-1" }],
      workspaceIds: ["ws-1"],
      workspaceTeamGrants: [{ teamId: "team-1", workspaceId: "ws-1" }],
    });
  });

  test("separates a cross-organization workspace-team grant instead of projecting it", async () => {
    vi.mocked(prisma.workspaceTeam.findMany).mockResolvedValue([
      { team: { organizationId: ORGANIZATION_ID }, teamId: "own-team", workspaceId: "ws-1" },
      { team: { organizationId: "other-org" }, teamId: "foreign-team", workspaceId: "ws-1" },
    ] as never);

    const source = await readOrganizationSource(ORGANIZATION_ID);

    // The foreign grant breaks the closed-unit invariant, so it is reported and then left alone —
    // neither projected nor pruned.
    expect(source.workspaceTeamGrants).toEqual([{ teamId: "own-team", workspaceId: "ws-1" }]);
    expect(source.invalidWorkspaceTeamGrants).toEqual([{ teamId: "foreign-team", workspaceId: "ws-1" }]);
  });

  test("separates a cross-organization API-key workspace grant instead of projecting it", async () => {
    // Keyed off the key's organization, so a grant can name a workspace another organization owns. That
    // workspace is outside this unit's observation, so projecting the grant would leave the unit
    // reporting a missing record forever — it can never be seen and so never converges.
    vi.mocked(prisma.apiKeyWorkspace.findMany).mockResolvedValue([
      { apiKeyId: "key-1", workspace: { organizationId: ORGANIZATION_ID }, workspaceId: "own-ws" },
      { apiKeyId: "key-1", workspace: { organizationId: "other-org" }, workspaceId: "foreign-ws" },
    ] as never);

    const source = await readOrganizationSource(ORGANIZATION_ID);

    expect(source.apiKeyWorkspaceGrants).toEqual([{ apiKeyId: "key-1", workspaceId: "own-ws" }]);
    expect(source.invalidApiKeyWorkspaceGrants).toEqual([{ apiKeyId: "key-1", workspaceId: "foreign-ws" }]);
  });

  test("reads a workspace's owning organization so a failure can be attributed to a tenant", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      organizationId: ORGANIZATION_ID,
    } as never);
    vi.mocked(prisma.workspaceTeam.findMany).mockResolvedValue([
      { team: { organizationId: ORGANIZATION_ID }, teamId: "team-1", workspaceId: "ws-1" },
    ] as never);

    await expect(readWorkspaceSource("ws-1")).resolves.toEqual({
      apiKeyWorkspaceGrants: [],
      invalidApiKeyWorkspaceGrants: [],
      invalidWorkspaceTeamGrants: [],
      organizationId: ORGANIZATION_ID,
      workspaceExists: true,
      workspaceTeamGrants: [{ teamId: "team-1", workspaceId: "ws-1" }],
    });
  });

  test("partitions a workspace grant whose principal belongs to another organization", async () => {
    // The join tables have independent foreign keys and no same-organization constraint, so a
    // cross-tenant row is representable — and `--workspace-id` must refuse to project it, exactly as
    // `--organization-id` does.
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      organizationId: ORGANIZATION_ID,
    } as never);
    vi.mocked(prisma.workspaceTeam.findMany).mockResolvedValue([
      { team: { organizationId: ORGANIZATION_ID }, teamId: "own-team", workspaceId: "ws-1" },
      { team: { organizationId: "other-org" }, teamId: "foreign-team", workspaceId: "ws-1" },
    ] as never);
    vi.mocked(prisma.apiKeyWorkspace.findMany).mockResolvedValue([
      { apiKey: { organizationId: "other-org" }, apiKeyId: "foreign-key", workspaceId: "ws-1" },
    ] as never);

    const source = await readWorkspaceSource("ws-1");

    expect(source.workspaceTeamGrants).toEqual([{ teamId: "own-team", workspaceId: "ws-1" }]);
    expect(source.invalidWorkspaceTeamGrants).toEqual([{ teamId: "foreign-team", workspaceId: "ws-1" }]);
    expect(source.apiKeyWorkspaceGrants).toEqual([]);
    expect(source.invalidApiKeyWorkspaceGrants).toEqual([{ apiKeyId: "foreign-key", workspaceId: "ws-1" }]);
  });

  test("reports a workspace with no row as absent rather than failing", async () => {
    // The case most worth repairing: the row is gone and its relationships are what should be removed.
    // Its grants are still read, because those rows can outlive the workspace.
    const source = await readWorkspaceSource("ghost-ws");

    expect(source.workspaceExists).toBe(false);
    expect(source.organizationId).toBeNull();
  });

  test("returns empty target lists for an organization with no records", async () => {
    const source = await readOrganizationSource(ORGANIZATION_ID);

    expect(source).toEqual({
      apiKeyIds: [],
      apiKeyWorkspaceGrants: [],
      invalidApiKeyWorkspaceGrants: [],
      invalidWorkspaceTeamGrants: [],
      memberships: [],
      teamIds: [],
      teamMemberships: [],
      workspaceIds: [],
      workspaceTeamGrants: [],
    });
  });

  test("propagates a failure from any single query", async () => {
    vi.mocked(prisma.teamUser.findMany).mockRejectedValue(new Error("statement timeout"));

    await expect(readOrganizationSource(ORGANIZATION_ID)).rejects.toThrow("statement timeout");
  });
});

describe("findMismatchedParentEdges", () => {
  test("reports a resource attached to an organization that does not own it", async () => {
    // The cross-tenant escalation an existence check cannot see: the workspace exists, so it is not an
    // orphan, but the edge names an organization whose owners and managers thereby gain access to it.
    vi.mocked(prisma.workspace.findMany).mockResolvedValue([
      { id: "ws-1", organizationId: ORGANIZATION_ID },
    ] as never);

    await expect(
      findMismatchedParentEdges([
        { childId: "ws-1", childType: "workspace", organizationId: "other-org", relation: "organization" },
      ])
    ).resolves.toEqual([
      { childId: "ws-1", childType: "workspace", organizationId: "other-org", relation: "organization" },
    ]);
  });

  test("accepts an edge naming the true owner", async () => {
    vi.mocked(prisma.team.findMany).mockResolvedValue([
      { id: "team-1", organizationId: ORGANIZATION_ID },
    ] as never);

    await expect(
      findMismatchedParentEdges([
        { childId: "team-1", childType: "team", organizationId: ORGANIZATION_ID, relation: "organization" },
      ])
    ).resolves.toEqual([]);
  });

  test("leaves an edge whose resource has no row to the orphan path", async () => {
    // That is a different finding with a working repair, so reporting it here too would double-count it.
    await expect(
      findMismatchedParentEdges([
        { childId: "gone", childType: "api_key", organizationId: ORGANIZATION_ID, relation: "organization" },
      ])
    ).resolves.toEqual([]);
  });

  test("checks all three child types in one batch per type", async () => {
    await findMismatchedParentEdges([
      { childId: "team-1", childType: "team", organizationId: ORGANIZATION_ID, relation: "organization" },
      { childId: "ws-1", childType: "workspace", organizationId: ORGANIZATION_ID, relation: "organization" },
      { childId: "key-1", childType: "api_key", organizationId: ORGANIZATION_ID, relation: "organization" },
    ]);

    expect(prisma.team.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.workspace.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.apiKey.findMany).toHaveBeenCalledTimes(1);
  });

  test("fails closed on a lookup error rather than reporting no mismatch", async () => {
    vi.mocked(prisma.workspace.findMany).mockRejectedValue(new Error("connection reset"));

    await expect(
      findMismatchedParentEdges([
        { childId: "ws-1", childType: "workspace", organizationId: "other-org", relation: "organization" },
      ])
    ).rejects.toThrow("connection reset");
  });
});

describe("findMissingSourceRefs", () => {
  const allKinds: ReadonlyArray<TAuthzedSourceRef> = [
    { apiKeyId: "key-1", kind: "apiKey" },
    { apiKeyId: "key-1", kind: "apiKeyWorkspaceGrant", workspaceId: "ws-1" },
    { kind: "membership", organizationId: ORGANIZATION_ID, userId: "user-1" },
    { kind: "team", teamId: "team-1" },
    { kind: "teamMembership", teamId: "team-1", userId: "user-1" },
    { kind: "workspace", workspaceId: "ws-1" },
    { kind: "workspaceTeamGrant", teamId: "team-1", workspaceId: "ws-1" },
  ];

  test("reports nothing missing when every record is present", async () => {
    vi.mocked(prisma.apiKey.findMany).mockResolvedValue([{ id: "key-1" }] as never);
    vi.mocked(prisma.apiKeyWorkspace.findMany).mockResolvedValue([
      { apiKeyId: "key-1", workspaceId: "ws-1" },
    ] as never);
    vi.mocked(prisma.membership.findMany).mockResolvedValue([
      { organizationId: ORGANIZATION_ID, userId: "user-1" },
    ] as never);
    vi.mocked(prisma.team.findMany).mockResolvedValue([{ id: "team-1" }] as never);
    vi.mocked(prisma.teamUser.findMany).mockResolvedValue([{ teamId: "team-1", userId: "user-1" }] as never);
    vi.mocked(prisma.workspace.findMany).mockResolvedValue([{ id: "ws-1" }] as never);
    vi.mocked(prisma.workspaceTeam.findMany).mockResolvedValue([
      { teamId: "team-1", workspaceId: "ws-1" },
    ] as never);

    await expect(findMissingSourceRefs(allKinds)).resolves.toEqual([]);
  });

  test("reports every kind of record that PostgreSQL does not hold", async () => {
    // Every query returns nothing, so all seven kinds are missing.
    await expect(findMissingSourceRefs(allKinds)).resolves.toEqual(allKinds);
  });

  test("distinguishes a present record from an absent one of the same kind", async () => {
    vi.mocked(prisma.team.findMany).mockResolvedValue([{ id: "present-team" }] as never);

    await expect(
      findMissingSourceRefs([
        { kind: "team", teamId: "present-team" },
        { kind: "team", teamId: "absent-team" },
      ])
    ).resolves.toEqual([{ kind: "team", teamId: "absent-team" }]);
  });

  test("does not confuse composite keys across pair boundaries", async () => {
    // A naive concatenated key would match ("ab", "c") against ("a", "bc").
    vi.mocked(prisma.teamUser.findMany).mockResolvedValue([{ teamId: "ab", userId: "c" }] as never);

    await expect(
      findMissingSourceRefs([
        { kind: "teamMembership", teamId: "ab", userId: "c" },
        { kind: "teamMembership", teamId: "a", userId: "bc" },
      ])
    ).resolves.toEqual([{ kind: "teamMembership", teamId: "a", userId: "bc" }]);
  });

  test("skips the query for a kind that was not asked about", async () => {
    await findMissingSourceRefs([{ kind: "team", teamId: "team-1" }]);

    expect(prisma.team.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.membership.findMany).not.toHaveBeenCalled();
    expect(prisma.apiKey.findMany).not.toHaveBeenCalled();
  });

  test("chunks a large request so the query cannot approach the bind-parameter ceiling", async () => {
    // The composite-key kinds contribute two bind parameters per record, so an unchunked list would build
    // exactly the unbounded OR that the chunk size exists to prevent.
    const refs = Array.from({ length: AUTHZED_BACKFILL_TARGET_CHUNK_SIZE + 1 }, (_unused, index) => ({
      kind: "teamMembership" as const,
      teamId: "team-1",
      userId: `user-${index}`,
    }));

    await findMissingSourceRefs(refs);

    expect(prisma.teamUser.findMany).toHaveBeenCalledTimes(2);
  });

  test("issues one batched query per kind rather than one per record", async () => {
    await findMissingSourceRefs([
      { kind: "team", teamId: "team-1" },
      { kind: "team", teamId: "team-2" },
      { kind: "team", teamId: "team-3" },
    ]);

    expect(prisma.team.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.team.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["team-1", "team-2", "team-3"] } },
      select: { id: true },
    });
  });

  test("fails closed: a query failure never presents records as absent", async () => {
    // This is the single most dangerous mistake available to this tooling. Treating a failed lookup as
    // "no source row" would classify live access as orphaned and, under pruning, revoke it at scale.
    vi.mocked(prisma.team.findMany).mockRejectedValue(new Error("connection pool exhausted"));

    await expect(findMissingSourceRefs([{ kind: "team", teamId: "team-1" }])).rejects.toThrow(
      "connection pool exhausted"
    );
  });

  test("returns nothing for an empty request without querying", async () => {
    await expect(findMissingSourceRefs([])).resolves.toEqual([]);

    expect(prisma.team.findMany).not.toHaveBeenCalled();
  });
});
