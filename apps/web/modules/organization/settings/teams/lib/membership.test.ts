import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, UnknownError } from "@formbricks/types/errors";
import {
  deleteMembership,
  getMembersByOrganizationId,
  getMembershipByOrganizationId,
  getMembershipsByUserId,
  getOrganizationOwnerCount,
} from "./membership";

vi.mock("@formbricks/database", () => ({
  prisma: {
    membership: {
      findMany: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    teamUser: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/constants", () => ({ ITEMS_PER_PAGE: 2 }));
vi.mock("@/lib/utils/validate", () => ({ validateInputs: vi.fn() }));
vi.mock("react", () => ({ cache: (fn) => fn }));
vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn() } }));

const organizationId = "org-1";
const userId = "user-1";
const teamId = "team-1";
const mockMember = {
  user: { name: "Test", email: "test@example.com", isActive: true },
  userId,
  accepted: true,
  role: "member",
};
const mockMembership = { userId, organizationId, role: "member", accepted: true };
const mockTeamMembership = { userId, role: "contributor", teamId };

describe("getMembershipByOrganizationId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test("returns members", async () => {
    vi.mocked(prisma.membership.findMany).mockResolvedValue([mockMember]);
    const result = await getMembershipByOrganizationId(organizationId, 1);
    expect(result[0].userId).toBe(userId);
    expect(result[0].name).toBe("Test");
    expect(result[0].email).toBe("test@example.com");
    expect(result[0].isActive).toBe(true);
  });
  test("throws DatabaseError on prisma error", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("db", {
      code: "P2002",
      clientVersion: "1.0.0",
    });
    vi.mocked(prisma.membership.findMany).mockRejectedValue(prismaError);
    await expect(getMembershipByOrganizationId(organizationId, 1)).rejects.toThrow(DatabaseError);
  });
  test("throws UnknownError on unknown error", async () => {
    vi.mocked(prisma.membership.findMany).mockRejectedValue({});
    await expect(getMembershipByOrganizationId(organizationId, 1)).rejects.toThrow(UnknownError);
  });
});

describe("getOrganizationOwnerCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test("returns owner count", async () => {
    vi.mocked(prisma.membership.count).mockResolvedValue(2);
    const result = await getOrganizationOwnerCount(organizationId);
    expect(result).toBe(2);
  });
  test("throws DatabaseError on prisma error", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("db", {
      code: "P2002",
      clientVersion: "1.0.0",
    });
    vi.mocked(prisma.membership.count).mockRejectedValue(prismaError);
    await expect(getOrganizationOwnerCount(organizationId)).rejects.toThrow(DatabaseError);
  });
  test("throws original error on unknown error", async () => {
    vi.mocked(prisma.membership.count).mockRejectedValue({});
    await expect(getOrganizationOwnerCount(organizationId)).rejects.toThrowError();
  });
});

describe("deleteMembership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test("deletes membership and returns deleted team memberships", async () => {
    vi.mocked(prisma.teamUser.findMany).mockResolvedValue([mockTeamMembership]);
    vi.mocked(prisma.$transaction).mockResolvedValue([{}, {}]);
    const result = await deleteMembership(userId, organizationId);
    expect(result[0].teamId).toBe(teamId);
  });
  test("throws DatabaseError on prisma error", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("db", {
      code: "P2002",
      clientVersion: "1.0.0",
    });
    vi.mocked(prisma.teamUser.findMany).mockRejectedValue(prismaError);
    await expect(deleteMembership(userId, organizationId)).rejects.toThrow(DatabaseError);
  });
  test("throws original error on unknown error", async () => {
    vi.mocked(prisma.teamUser.findMany).mockRejectedValue({});
    await expect(deleteMembership(userId, organizationId)).rejects.toThrowError();
  });
});

describe("getMembershipsByUserId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test("returns memberships", async () => {
    vi.mocked(prisma.membership.findMany).mockResolvedValue([mockMembership]);
    const result = await getMembershipsByUserId(userId, 1);
    expect(result[0].userId).toBe(userId);
    expect(result[0].organizationId).toBe(organizationId);
  });
  test("throws DatabaseError on prisma error", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("db", {
      code: "P2002",
      clientVersion: "1.0.0",
    });
    vi.mocked(prisma.membership.findMany).mockRejectedValue(prismaError);
    await expect(getMembershipsByUserId(userId, 1)).rejects.toThrow(DatabaseError);
  });

  test("throws UnknownError on unknown error", async () => {
    vi.mocked(prisma.membership.findMany).mockRejectedValue(new Error("unknown"));
    await expect(getMembershipsByUserId(userId, 1)).rejects.toThrow(Error);
  });
});

describe("getMembersByOrganizationId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test("returns members", async () => {
    vi.mocked(prisma.membership.findMany).mockResolvedValue([
      { user: { name: "Test" }, role: "member", userId },
    ]);
    const result = await getMembersByOrganizationId(organizationId);
    expect(result[0].id).toBe(userId);
    expect(result[0].name).toBe("Test");
    expect(result[0].role).toBe("member");
  });
  test("throws DatabaseError on prisma error", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("db", {
      code: "P2002",
      clientVersion: "1.0.0",
    });
    vi.mocked(prisma.membership.findMany).mockRejectedValue(prismaError);
    await expect(getMembersByOrganizationId(organizationId)).rejects.toThrow(DatabaseError);
  });
  test("throws original on unknown error", async () => {
    vi.mocked(prisma.membership.findMany).mockRejectedValue(new Error("unknown"));
    await expect(getMembersByOrganizationId(organizationId)).rejects.toThrow(Error);
  });
});
