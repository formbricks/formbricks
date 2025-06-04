import { TTeamSettingsFormSchema } from "@/modules/ee/teams/team-list/types/team";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  createTeam,
  deleteTeam,
  getOtherTeams,
  getTeamDetails,
  getTeams,
  getTeamsByOrganizationId,
  getUserTeams,
  updateTeamDetails,
} from "./team";

vi.mock("@formbricks/database", () => ({
  prisma: {
    team: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    membership: { findUnique: vi.fn(), count: vi.fn() },
    project: { count: vi.fn() },
    environment: { findMany: vi.fn() },
  },
}));

const mockTeams = [
  { id: "t1", name: "Team 1" },
  { id: "t2", name: "Team 2" },
];
const mockUserTeams = [
  {
    id: "t1",
    name: "Team 1",
    teamUsers: [{ role: "admin" }],
    _count: { teamUsers: 2 },
  },
];
const mockOtherTeams = [
  {
    id: "t2",
    name: "Team 2",
    _count: { teamUsers: 3 },
  },
];
const mockMembership = { role: "admin" };
const mockTeamDetails = {
  id: "t1",
  name: "Team 1",
  organizationId: "org1",
  teamUsers: [
    { userId: "u1", role: "admin", user: { name: "User 1" } },
    { userId: "u2", role: "member", user: { name: "User 2" } },
  ],
  projectTeams: [{ projectId: "p1", project: { name: "Project 1" }, permission: "manage" }],
};

describe("getTeamsByOrganizationId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test("returns mapped teams", async () => {
    vi.mocked(prisma.team.findMany).mockResolvedValueOnce(mockTeams);
    const result = await getTeamsByOrganizationId("org1");
    expect(result).toEqual([
      { id: "t1", name: "Team 1" },
      { id: "t2", name: "Team 2" },
    ]);
  });
  test("throws DatabaseError on Prisma error", async () => {
    vi.mocked(prisma.team.findMany).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("fail", { code: "P2002", clientVersion: "1.0.0" })
    );
    await expect(getTeamsByOrganizationId("org1")).rejects.toThrow(DatabaseError);
  });
});

describe("getUserTeams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test("returns mapped user teams", async () => {
    vi.mocked(prisma.team.findMany).mockResolvedValueOnce(mockUserTeams);

    const result = await getUserTeams("u1", "org1");
    expect(result).toEqual([{ id: "t1", name: "Team 1", userRole: "admin", memberCount: 2 }]);
  });
  test("throws DatabaseError on Prisma error", async () => {
    vi.mocked(prisma.team.findMany).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("fail", { code: "P2002", clientVersion: "1.0.0" })
    );
    await expect(getUserTeams("u1", "org1")).rejects.toThrow(DatabaseError);
  });
});

describe("getOtherTeams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test("returns mapped other teams", async () => {
    vi.mocked(prisma.team.findMany).mockResolvedValueOnce(mockOtherTeams);
    const result = await getOtherTeams("u1", "org1");
    expect(result).toEqual([{ id: "t2", name: "Team 2", memberCount: 3 }]);
  });
  test("throws DatabaseError on Prisma error", async () => {
    vi.mocked(prisma.team.findMany).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("fail", { code: "P2002", clientVersion: "1.0.0" })
    );
    await expect(getOtherTeams("u1", "org1")).rejects.toThrow(DatabaseError);
  });
});

describe("getTeams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test("returns userTeams and otherTeams", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValueOnce(mockMembership);
    vi.mocked(prisma.team.findMany).mockResolvedValueOnce(mockUserTeams);
    vi.mocked(prisma.team.findMany).mockResolvedValueOnce(mockOtherTeams);
    const result = await getTeams("u1", "org1");
    expect(result).toEqual({
      userTeams: [{ id: "t1", name: "Team 1", userRole: "admin", memberCount: 2 }],
      otherTeams: [{ id: "t2", name: "Team 2", memberCount: 3 }],
    });
  });
  test("throws ResourceNotFoundError if membership not found", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValueOnce(null);
    await expect(getTeams("u1", "org1")).rejects.toThrow(ResourceNotFoundError);
  });
});

describe("createTeam", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test("creates and returns team id", async () => {
    vi.mocked(prisma.team.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.team.create).mockResolvedValueOnce({
      id: "t1",
      name: "Team 1",
      organizationId: "org1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const result = await createTeam("org1", "Team 1");
    expect(result).toBe("t1");
  });
  test("throws InvalidInputError if team exists", async () => {
    vi.mocked(prisma.team.findFirst).mockResolvedValueOnce({ id: "t1" });
    await expect(createTeam("org1", "Team 1")).rejects.toThrow(InvalidInputError);
  });
  test("throws InvalidInputError if name too short", async () => {
    vi.mocked(prisma.team.findFirst).mockResolvedValueOnce(null);
    await expect(createTeam("org1", "")).rejects.toThrow(InvalidInputError);
  });
  test("throws DatabaseError on Prisma error", async () => {
    vi.mocked(prisma.team.findFirst).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("fail", { code: "P2002", clientVersion: "1.0.0" })
    );
    await expect(createTeam("org1", "Team 1")).rejects.toThrow(DatabaseError);
  });
});

describe("getTeamDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test("returns mapped team details", async () => {
    vi.mocked(prisma.team.findUnique).mockResolvedValueOnce(mockTeamDetails);
    const result = await getTeamDetails("t1");
    expect(result).toEqual({
      id: "t1",
      name: "Team 1",
      organizationId: "org1",
      members: [
        { userId: "u1", name: "User 1", role: "admin" },
        { userId: "u2", name: "User 2", role: "member" },
      ],
      projects: [{ projectId: "p1", projectName: "Project 1", permission: "manage" }],
    });
  });
  test("returns null if team not found", async () => {
    vi.mocked(prisma.team.findUnique).mockResolvedValueOnce(null);
    const result = await getTeamDetails("t1");
    expect(result).toBeNull();
  });
  test("throws DatabaseError on Prisma error", async () => {
    vi.mocked(prisma.team.findUnique).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("fail", { code: "P2002", clientVersion: "1.0.0" })
    );
    await expect(getTeamDetails("t1")).rejects.toThrow(DatabaseError);
  });
});

describe("deleteTeam", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test("deletes team and revalidates caches", async () => {
    const mockTeam = {
      id: "t1",
      organizationId: "org1",
      name: "Team 1",
      createdAt: new Date(),
      updatedAt: new Date(),
      projectTeams: [{ projectId: "p1" }],
    };
    vi.mocked(prisma.team.delete).mockResolvedValueOnce(mockTeam);
    const result = await deleteTeam("t1");
    expect(result).toBe(true);
  });
  test("throws DatabaseError on Prisma error", async () => {
    vi.mocked(prisma.team.delete).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("fail", { code: "P2002", clientVersion: "1.0.0" })
    );
    await expect(deleteTeam("t1")).rejects.toThrow(DatabaseError);
  });
});

describe("updateTeamDetails", () => {
  const data: TTeamSettingsFormSchema = {
    name: "Team 1 Updated",
    members: [{ userId: "u1", role: "admin" }],
    projects: [{ projectId: "p1", permission: "manage" }],
  };
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test("updates team details and revalidates caches", async () => {
    vi.mocked(prisma.team.findUnique).mockResolvedValueOnce({
      id: "t1",
      organizationId: "org1",
      name: "Team 1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(prisma.team.findUnique).mockResolvedValueOnce(mockTeamDetails);
    vi.mocked(prisma.team.findMany).mockResolvedValueOnce(mockUserTeams);

    vi.mocked(prisma.membership.count).mockResolvedValueOnce(1);
    vi.mocked(prisma.project.count).mockResolvedValueOnce(1);
    vi.mocked(prisma.team.update).mockResolvedValueOnce({
      id: "t1",
      name: "Team 1 Updated",
      organizationId: "org1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(prisma.environment.findMany).mockResolvedValueOnce([{ id: "env1" }]);
    const result = await updateTeamDetails("t1", data);
    expect(result).toBe(true);
  });
  test("throws ResourceNotFoundError if team not found", async () => {
    vi.mocked(prisma.team.findUnique).mockResolvedValueOnce(null);
    await expect(updateTeamDetails("t1", data)).rejects.toThrow(ResourceNotFoundError);
  });
  test("throws error if getTeamDetails returns null", async () => {
    vi.mocked(prisma.team.findUnique).mockResolvedValueOnce({
      id: "t1",
      organizationId: "org1",
      name: "Team 1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(prisma.team.findUnique).mockResolvedValueOnce(null);
    await expect(updateTeamDetails("t1", data)).rejects.toThrow("Team not found");
  });
  test("throws error if user not in org membership", async () => {
    vi.mocked(prisma.team.findUnique).mockResolvedValueOnce({
      id: "t1",
      organizationId: "org1",
      name: "Team 1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(prisma.team.findUnique).mockResolvedValueOnce({
      id: "t1",
      name: "Team 1",
      organizationId: "org1",
      members: [],
      projects: [],
    });
    vi.mocked(prisma.membership.count).mockResolvedValueOnce(0);
    await expect(updateTeamDetails("t1", data)).rejects.toThrow();
  });
  test("throws error if project not in org", async () => {
    vi.mocked(prisma.team.findUnique).mockResolvedValueOnce({
      id: "t1",
      organizationId: "org1",
      name: "Team 1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(prisma.team.findUnique).mockResolvedValueOnce({
      id: "t1",
      name: "Team 1",
      organizationId: "org1",
      members: [],
      projects: [],
    });
    vi.mocked(prisma.membership.count).mockResolvedValueOnce(1);
    vi.mocked(prisma.project.count).mockResolvedValueOnce(0);
    await expect(
      updateTeamDetails("t1", {
        name: "x",
        members: [],
        projects: [{ projectId: "p1", permission: "manage" }],
      })
    ).rejects.toThrow();
  });
  test("throws DatabaseError on Prisma error", async () => {
    vi.mocked(prisma.team.findUnique).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("fail", { code: "P2002", clientVersion: "1.0.0" })
    );
    await expect(updateTeamDetails("t1", data)).rejects.toThrow(DatabaseError);
  });
});
