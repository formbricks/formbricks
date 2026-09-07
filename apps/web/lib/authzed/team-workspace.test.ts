import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { type TAuthzedRelationshipUpdate, getAuthzedClient } from "./client";
import { isAuthzedEnabled } from "./config";
import { AUTHZED_MAX_PARALLEL_RELATIONSHIP_DELETES } from "./constants";
import { AUTHZED_ERROR_CODES, AuthzedError } from "./errors";
import { deleteUserTeamRelationships, reconcileTeamWorkspaceRelationships } from "./team-workspace";

const clientMocks = {
  deleteRelationships: vi.fn(),
  writeRelationships: vi.fn(),
};

vi.mock("@formbricks/database", () => ({
  prisma: {
    team: { findMany: vi.fn() },
    teamUser: { findMany: vi.fn() },
    workspace: { findMany: vi.fn() },
    workspaceTeam: { findMany: vi.fn() },
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

const TEAM_ID = "team-private-id";
const USER_ID = "user-private-id";
const WORKSPACE_ID = "workspace-private-id";
const ORGANIZATION_ID = "organization-private-id";

const setStableSnapshot = ({
  teamRole = "admin",
  workspacePermission = "read",
}: Readonly<{
  teamRole?: "admin" | "contributor" | null;
  workspacePermission?: "manage" | "read" | "readWrite" | null;
}> = {}): void => {
  vi.mocked(prisma.team.findMany).mockResolvedValue([
    { id: TEAM_ID, organizationId: ORGANIZATION_ID },
  ] as never);
  vi.mocked(prisma.workspace.findMany).mockResolvedValue([
    { id: WORKSPACE_ID, organizationId: ORGANIZATION_ID },
  ] as never);
  vi.mocked(prisma.teamUser.findMany).mockResolvedValue(
    teamRole === null ? [] : ([{ role: teamRole, teamId: TEAM_ID, userId: USER_ID }] as never)
  );
  vi.mocked(prisma.workspaceTeam.findMany).mockResolvedValue(
    workspacePermission === null
      ? []
      : ([{ permission: workspacePermission, teamId: TEAM_ID, workspaceId: WORKSPACE_ID }] as never)
  );
};

describe("team and workspace relationship projection", () => {
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

  test.each([
    ["admin", "admin"],
    ["contributor", "contributor"],
  ] as const)("projects a %s team membership and deletes its alternate role", async (role, relation) => {
    setStableSnapshot({ teamRole: role });

    await expect(
      reconcileTeamWorkspaceRelationships({
        teamMemberships: [{ teamId: TEAM_ID, userId: USER_ID }],
      })
    ).resolves.toEqual({ passes: 1, status: "projected" });

    const updates = clientMocks.writeRelationships.mock.calls.flatMap(([batch]) => batch);
    const roleUpdates = updates.filter(
      ({ relationship }) =>
        relationship.resource.objectType === "team" && relationship.subject.objectType === "user"
    );
    expect(roleUpdates).toHaveLength(2);
    expect(roleUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: "touch",
          relationship: expect.objectContaining({ relation }),
        }),
      ])
    );
    expect(roleUpdates.filter(({ operation }) => operation === "delete")).toHaveLength(1);
  });

  test.each([
    ["read", "reader_team"],
    ["readWrite", "writer_team"],
    ["manage", "manager_team"],
  ] as const)(
    "projects a %s workspace grant through the team#member subject and deletes alternate grants",
    async (permission, relation) => {
      setStableSnapshot({ workspacePermission: permission });

      await expect(
        reconcileTeamWorkspaceRelationships({
          workspaceTeamGrants: [{ teamId: TEAM_ID, workspaceId: WORKSPACE_ID }],
        })
      ).resolves.toEqual({ passes: 1, status: "projected" });

      const updates = clientMocks.writeRelationships.mock.calls.flatMap(([batch]) => batch);
      const grantUpdates = updates.filter(
        ({ relationship }) =>
          relationship.resource.objectType === "workspace" && relationship.subject.objectType === "team"
      );
      expect(grantUpdates).toHaveLength(3);
      expect(grantUpdates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            operation: "touch",
            relationship: expect.objectContaining({
              relation,
              subject: expect.objectContaining({ relation: "member" }),
            }),
          }),
        ])
      );
      expect(grantUpdates.filter(({ operation }) => operation === "delete")).toHaveLength(2);
    }
  );

  test("projects team and workspace organization parents for pair-only targets", async () => {
    await reconcileTeamWorkspaceRelationships({
      teamMemberships: [{ teamId: TEAM_ID, userId: USER_ID }],
      workspaceTeamGrants: [{ teamId: TEAM_ID, workspaceId: WORKSPACE_ID }],
    });

    const updates = clientMocks.writeRelationships.mock.calls.flatMap(([batch]) => batch);
    expect(updates).toEqual(
      expect.arrayContaining([
        {
          operation: "touch",
          relationship: {
            relation: "organization",
            resource: { objectId: TEAM_ID, objectType: "team" },
            subject: { objectId: ORGANIZATION_ID, objectType: "organization" },
          },
        },
        {
          operation: "touch",
          relationship: {
            relation: "organization",
            resource: { objectId: WORKSPACE_ID, objectType: "workspace" },
            subject: { objectId: ORGANIZATION_ID, objectType: "organization" },
          },
        },
      ])
    );
  });

  test("removes every previous team and workspace parent before restoring the current parents", async () => {
    await reconcileTeamWorkspaceRelationships({
      teamIds: [TEAM_ID],
      workspaceIds: [WORKSPACE_ID],
    });

    expect(clientMocks.deleteRelationships).toHaveBeenCalledWith({
      relation: "organization",
      resourceId: TEAM_ID,
      resourceType: "team",
    });
    expect(clientMocks.deleteRelationships).toHaveBeenCalledWith({
      relation: "organization",
      resourceId: WORKSPACE_ID,
      resourceType: "workspace",
    });
    expect(Math.max(...clientMocks.deleteRelationships.mock.invocationCallOrder)).toBeLessThan(
      clientMocks.writeRelationships.mock.invocationCallOrder[0]
    );
  });

  test("projects multiple team grants independently without precomputing a user permission", async () => {
    const secondTeamId = "second-team";
    vi.mocked(prisma.team.findMany).mockResolvedValue([
      { id: TEAM_ID, organizationId: ORGANIZATION_ID },
      { id: secondTeamId, organizationId: ORGANIZATION_ID },
    ] as never);
    vi.mocked(prisma.workspaceTeam.findMany).mockResolvedValue([
      { permission: "read", teamId: TEAM_ID, workspaceId: WORKSPACE_ID },
      { permission: "manage", teamId: secondTeamId, workspaceId: WORKSPACE_ID },
    ] as never);

    await reconcileTeamWorkspaceRelationships({
      workspaceTeamGrants: [
        { teamId: TEAM_ID, workspaceId: WORKSPACE_ID },
        { teamId: secondTeamId, workspaceId: WORKSPACE_ID },
      ],
    });

    const touchedRelations = clientMocks.writeRelationships.mock.calls
      .flatMap(([batch]) => batch)
      .filter(
        ({ operation, relationship }) => operation === "touch" && relationship.subject.objectType === "team"
      )
      .map(({ relationship }) => relationship.relation);
    expect(touchedRelations).toEqual(expect.arrayContaining(["reader_team", "manager_team"]));
  });

  test("deletes all role and grant alternatives when source rows are absent", async () => {
    setStableSnapshot({ teamRole: null, workspacePermission: null });

    await reconcileTeamWorkspaceRelationships({
      teamMemberships: [{ teamId: TEAM_ID, userId: USER_ID }],
      workspaceTeamGrants: [{ teamId: TEAM_ID, workspaceId: WORKSPACE_ID }],
    });

    const pairUpdates = clientMocks.writeRelationships.mock.calls
      .flatMap(([batch]) => batch)
      .filter(({ relationship }) => relationship.relation !== "organization");
    expect(pairUpdates).toHaveLength(5);
    expect(pairUpdates.every(({ operation }) => operation === "delete")).toBe(true);
  });

  test("cleans a missing team resource and every workspace grant where it is the subject", async () => {
    vi.mocked(prisma.team.findMany).mockResolvedValue([]);

    await reconcileTeamWorkspaceRelationships({ teamIds: [TEAM_ID] });

    expect(clientMocks.deleteRelationships).toHaveBeenNthCalledWith(1, {
      resourceId: TEAM_ID,
      resourceType: "team",
    });
    expect(clientMocks.deleteRelationships).toHaveBeenNthCalledWith(2, {
      resourceType: "workspace",
      subject: { objectId: TEAM_ID, objectType: "team", relation: "member" },
    });
  });

  test("cleans every relationship on a missing workspace resource", async () => {
    vi.mocked(prisma.workspace.findMany).mockResolvedValue([]);

    await reconcileTeamWorkspaceRelationships({ workspaceIds: [WORKSPACE_ID] });

    expect(clientMocks.deleteRelationships).toHaveBeenCalledWith({
      resourceId: WORKSPACE_ID,
      resourceType: "workspace",
    });
  });

  test("bounds parallel relationship deletion for large cascades", async () => {
    const missingTeamIds = Array.from({ length: 12 }, (_, index) => `missing-team-${index}`);
    let activeDeletes = 0;
    let maxActiveDeletes = 0;
    vi.mocked(prisma.team.findMany).mockResolvedValue([]);
    clientMocks.deleteRelationships.mockImplementation(async () => {
      activeDeletes++;
      maxActiveDeletes = Math.max(maxActiveDeletes, activeDeletes);
      await Promise.resolve();
      activeDeletes--;
    });

    await reconcileTeamWorkspaceRelationships({ teamIds: missingTeamIds });

    expect(clientMocks.deleteRelationships).toHaveBeenCalledTimes(missingTeamIds.length * 2);
    expect(maxActiveDeletes).toBe(AUTHZED_MAX_PARALLEL_RELATIONSHIP_DELETES);
  });

  test("deduplicates resource and pair targets", async () => {
    await reconcileTeamWorkspaceRelationships({
      teamIds: [TEAM_ID, TEAM_ID],
      teamMemberships: [
        { teamId: TEAM_ID, userId: USER_ID },
        { teamId: TEAM_ID, userId: USER_ID },
      ],
      workspaceIds: [WORKSPACE_ID, WORKSPACE_ID],
      workspaceTeamGrants: [
        { teamId: TEAM_ID, workspaceId: WORKSPACE_ID },
        { teamId: TEAM_ID, workspaceId: WORKSPACE_ID },
      ],
    });

    const updates = clientMocks.writeRelationships.mock.calls.flatMap(([batch]) => batch);
    expect(updates).toHaveLength(7);
  });

  test("packs at most 1,000 updates without splitting a three-update grant", async () => {
    const teamIds = Array.from({ length: 999 }, (_, index) => `team-${index}`);
    const grantTeamId = teamIds[0];
    vi.mocked(prisma.team.findMany).mockResolvedValue(
      teamIds.map((id) => ({ id, organizationId: ORGANIZATION_ID })) as never
    );
    vi.mocked(prisma.workspace.findMany).mockResolvedValue([
      { id: WORKSPACE_ID, organizationId: ORGANIZATION_ID },
    ] as never);
    vi.mocked(prisma.teamUser.findMany).mockResolvedValue([]);
    vi.mocked(prisma.workspaceTeam.findMany).mockResolvedValue([
      { permission: "read", teamId: grantTeamId, workspaceId: WORKSPACE_ID },
    ] as never);

    await reconcileTeamWorkspaceRelationships({
      teamIds,
      workspaceTeamGrants: [{ teamId: grantTeamId, workspaceId: WORKSPACE_ID }],
    });

    expect(clientMocks.writeRelationships).toHaveBeenCalledTimes(2);
    expect(clientMocks.writeRelationships.mock.calls[0][0]).toHaveLength(1_000);
    expect(clientMocks.writeRelationships.mock.calls[1][0]).toHaveLength(3);
    const finalBatch = clientMocks.writeRelationships.mock
      .calls[1][0] as ReadonlyArray<TAuthzedRelationshipUpdate>;
    expect(finalBatch.every(({ relationship }) => relationship.subject.objectType === "team")).toBe(true);
  });

  test("reconciles a complete snapshot again when source state changes concurrently", async () => {
    vi.mocked(prisma.teamUser.findMany)
      .mockResolvedValueOnce([{ role: "admin", teamId: TEAM_ID, userId: USER_ID }] as never)
      .mockResolvedValueOnce([{ role: "contributor", teamId: TEAM_ID, userId: USER_ID }] as never)
      .mockResolvedValueOnce([{ role: "contributor", teamId: TEAM_ID, userId: USER_ID }] as never)
      .mockResolvedValueOnce([{ role: "contributor", teamId: TEAM_ID, userId: USER_ID }] as never);

    await expect(
      reconcileTeamWorkspaceRelationships({
        teamMemberships: [{ teamId: TEAM_ID, userId: USER_ID }],
      })
    ).resolves.toEqual({ passes: 2, status: "projected" });

    expect(clientMocks.writeRelationships).toHaveBeenCalledTimes(2);
  });

  test("returns a stable failure after three changing snapshots", async () => {
    vi.mocked(prisma.teamUser.findMany)
      .mockResolvedValueOnce([{ role: "admin", teamId: TEAM_ID, userId: USER_ID }] as never)
      .mockResolvedValueOnce([{ role: "contributor", teamId: TEAM_ID, userId: USER_ID }] as never)
      .mockResolvedValueOnce([{ role: "admin", teamId: TEAM_ID, userId: USER_ID }] as never)
      .mockResolvedValueOnce([{ role: "contributor", teamId: TEAM_ID, userId: USER_ID }] as never)
      .mockResolvedValueOnce([{ role: "admin", teamId: TEAM_ID, userId: USER_ID }] as never)
      .mockResolvedValueOnce([{ role: "contributor", teamId: TEAM_ID, userId: USER_ID }] as never);

    await expect(
      reconcileTeamWorkspaceRelationships({
        teamMemberships: [{ teamId: TEAM_ID, userId: USER_ID }],
      })
    ).resolves.toEqual({
      attempts: 3,
      code: "authzed_projection_unstable",
      retryable: false,
      status: "failed",
    });
  });

  test("returns disabled before reading PostgreSQL or constructing a client", async () => {
    vi.mocked(isAuthzedEnabled).mockReturnValue(false);

    await expect(reconcileTeamWorkspaceRelationships({ teamIds: [TEAM_ID] })).resolves.toEqual({
      status: "disabled",
    });

    expect(prisma.team.findMany).not.toHaveBeenCalled();
    expect(getAuthzedClient).not.toHaveBeenCalled();
  });

  test("treats an empty target set as a zero-pass no-op without constructing a client", async () => {
    await expect(reconcileTeamWorkspaceRelationships({})).resolves.toEqual({
      passes: 0,
      status: "projected",
    });

    expect(prisma.team.findMany).not.toHaveBeenCalled();
    expect(getAuthzedClient).not.toHaveBeenCalled();
  });

  test("contains operational failures with sanitized logs and results", async () => {
    clientMocks.writeRelationships.mockRejectedValue(
      new AuthzedError({
        attempts: 3,
        cause: new Error("raw-sdk-message-with-private-token"),
        code: AUTHZED_ERROR_CODES.UNAVAILABLE,
        operation: "write_relationships",
        retryable: true,
      })
    );

    await expect(
      reconcileTeamWorkspaceRelationships({
        teamMemberships: [{ teamId: TEAM_ID, userId: USER_ID }],
      })
    ).resolves.toEqual({
      attempts: 3,
      code: AUTHZED_ERROR_CODES.UNAVAILABLE,
      retryable: true,
      status: "failed",
    });

    const serializedLog = JSON.stringify(vi.mocked(logger.warn).mock.calls[0]);
    expect(serializedLog).not.toContain(TEAM_ID);
    expect(serializedLog).not.toContain(USER_ID);
    expect(serializedLog).not.toContain("private-token");
    expect(serializedLog).not.toContain("raw-sdk-message");
  });

  test("does not restore a parent or report success when exact parent cleanup fails", async () => {
    clientMocks.deleteRelationships.mockRejectedValue(
      new AuthzedError({
        attempts: 3,
        code: AUTHZED_ERROR_CODES.UNAVAILABLE,
        operation: "delete_relationships",
        retryable: true,
      })
    );

    await expect(reconcileTeamWorkspaceRelationships({ teamIds: [TEAM_ID] })).resolves.toEqual({
      attempts: 3,
      code: AUTHZED_ERROR_CODES.UNAVAILABLE,
      retryable: true,
      status: "failed",
    });
    expect(clientMocks.writeRelationships).not.toHaveBeenCalled();
  });

  test("deletes only user-subject relationships on team resources", async () => {
    await expect(deleteUserTeamRelationships(USER_ID)).resolves.toEqual({
      passes: 1,
      status: "projected",
    });

    expect(clientMocks.deleteRelationships).toHaveBeenCalledWith({
      resourceType: "team",
      subject: { objectId: USER_ID, objectType: "user" },
    });
  });
});
