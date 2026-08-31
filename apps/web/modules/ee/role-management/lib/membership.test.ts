import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { reconcileOrganizationMembership } from "@/lib/authzed/organization-membership";
import { reconcileTeamWorkspaceRelationships } from "@/lib/authzed/team-workspace";
import { updateMembership } from "./membership";

vi.mock("@formbricks/database", () => ({
  prisma: {
    membership: {
      update: vi.fn(),
      findMany: vi.fn(),
    },
    teamUser: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/authzed/organization-membership", () => ({
  reconcileOrganizationMembership: vi.fn(),
}));
vi.mock("@/lib/authzed/team-workspace", () => ({
  reconcileTeamWorkspaceRelationships: vi.fn(),
}));

describe("updateMembership", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should update membership and related caches", async () => {
    const mockMembership = {
      id: "1",
      userId: "user1",
      organizationId: "org1",
      role: "owner" as TOrganizationRole,
      accepted: true,
      deprecatedRole: null,
    };

    const mockTeamMemberships = [{ teamId: "team1" }, { teamId: "team2" }];

    vi.mocked(prisma.membership.update).mockResolvedValue(mockMembership);
    vi.mocked(prisma.teamUser.findMany).mockResolvedValue(mockTeamMemberships as any);

    const result = await updateMembership("user1", "org1", { role: "owner" });

    expect(result).toEqual(mockMembership);
    expect(prisma.membership.update).toHaveBeenCalledWith({
      where: {
        userId_organizationId: {
          userId: "user1",
          organizationId: "org1",
        },
      },
      data: { role: "owner" },
    });
    expect(reconcileOrganizationMembership).toHaveBeenCalledWith("org1", "user1");
    expect(reconcileTeamWorkspaceRelationships).toHaveBeenCalledWith({
      teamMemberships: [
        { teamId: "team1", userId: "user1" },
        { teamId: "team2", userId: "user1" },
      ],
    });
  });

  test("should throw ResourceNotFoundError when membership doesn't exist", async () => {
    const error = new Prisma.PrismaClientKnownRequestError("Record does not exist", {
      code: PrismaErrorType.RecordNotFound,
      clientVersion: "1.0.0",
    });

    vi.mocked(prisma.membership.update).mockRejectedValue(error);

    await expect(updateMembership("user1", "org1", { role: "owner" })).rejects.toThrow(
      new ResourceNotFoundError("Membership", "userId: user1, organizationId: org1")
    );
  });

  test("should update team roles when role is changed to manager", async () => {
    const mockMembership = {
      id: "1",
      userId: "user1",
      organizationId: "org1",
      role: "manager" as TOrganizationRole,
      accepted: true,
      deprecatedRole: null,
    };

    const mockTeamMemberships = [{ teamId: "team1" }, { teamId: "team2" }];

    vi.mocked(prisma.membership.update).mockResolvedValue(mockMembership);
    vi.mocked(prisma.teamUser.findMany).mockResolvedValue(mockTeamMemberships as any);

    const result = await updateMembership("user1", "org1", { role: "manager" });

    expect(result).toEqual(mockMembership);
    expect(prisma.teamUser.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user1",
        team: {
          organizationId: "org1",
        },
      },
      data: {
        role: "admin",
      },
    });
    expect(reconcileTeamWorkspaceRelationships).toHaveBeenCalledWith({
      teamMemberships: [
        { teamId: "team1", userId: "user1" },
        { teamId: "team2", userId: "user1" },
      ],
    });
  });

  test("includes memberships added while team roles are being updated in reconciliation", async () => {
    const mockMembership = {
      id: "1",
      userId: "user1",
      organizationId: "org1",
      role: "manager" as TOrganizationRole,
      accepted: true,
      deprecatedRole: null,
    };
    let roleUpdateCompleted = false;

    vi.mocked(prisma.membership.update).mockResolvedValue(mockMembership);
    vi.mocked(prisma.teamUser.updateMany).mockImplementation((() => {
      roleUpdateCompleted = true;
      return Promise.resolve({ count: 2 });
    }) as never);
    vi.mocked(prisma.teamUser.findMany).mockImplementation((() =>
      Promise.resolve(roleUpdateCompleted ? [{ teamId: "team1" }, { teamId: "team2" }] : [])) as never);

    await updateMembership("user1", "org1", { role: "manager" });

    expect(reconcileTeamWorkspaceRelationships).toHaveBeenCalledWith({
      teamMemberships: [
        { teamId: "team1", userId: "user1" },
        { teamId: "team2", userId: "user1" },
      ],
    });
  });

  test("uses a transaction client without projecting before the outer transaction commits", async () => {
    const mockMembership = {
      id: "1",
      userId: "user1",
      organizationId: "org1",
      role: "member" as TOrganizationRole,
      accepted: true,
      deprecatedRole: null,
    };
    const tx = {
      membership: {
        update: vi.fn().mockResolvedValue(mockMembership),
        findMany: vi.fn().mockResolvedValue([{ userId: "user1" }]),
      },
      teamUser: {
        findMany: vi.fn().mockResolvedValue([{ teamId: "team1" }]),
        updateMany: vi.fn(),
      },
    } as unknown as Prisma.TransactionClient;

    await expect(updateMembership("user1", "org1", { role: "member" }, tx)).resolves.toEqual(mockMembership);

    expect(tx.membership.update).toHaveBeenCalled();
    expect(prisma.membership.update).not.toHaveBeenCalled();
    expect(reconcileOrganizationMembership).not.toHaveBeenCalled();
    expect(reconcileTeamWorkspaceRelationships).not.toHaveBeenCalled();
  });
});
