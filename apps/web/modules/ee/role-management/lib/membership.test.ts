import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { TOrganizationRole } from "@formbricks/types/memberships";
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

    const mockOrganizationMembers = [{ userId: "user1" }, { userId: "user2" }];

    vi.mocked(prisma.membership.update).mockResolvedValue(mockMembership);
    vi.mocked(prisma.teamUser.findMany).mockResolvedValue(mockTeamMemberships);
    vi.mocked(prisma.membership.findMany).mockResolvedValue(mockOrganizationMembers);

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
  });

  test("should throw ResourceNotFoundError when membership doesn't exist", async () => {
    const error = new Prisma.PrismaClientKnownRequestError("Record does not exist", {
      code: PrismaErrorType.RecordDoesNotExist,
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

    const mockOrganizationMembers = [{ userId: "user1" }, { userId: "user2" }];

    vi.mocked(prisma.membership.update).mockResolvedValue(mockMembership);
    vi.mocked(prisma.teamUser.findMany).mockResolvedValue(mockTeamMemberships);
    vi.mocked(prisma.membership.findMany).mockResolvedValue(mockOrganizationMembers);

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
  });
});
