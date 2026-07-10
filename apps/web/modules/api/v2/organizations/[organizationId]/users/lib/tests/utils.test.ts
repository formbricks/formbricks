import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getUserManagementAccess } from "@/lib/membership/utils";
import { buildCommonFilterQuery, pickCommonFilter } from "@/modules/api/v2/management/lib/utils";
import { TGetUsersFilter } from "@/modules/api/v2/organizations/[organizationId]/users/types/users";
import {
  canAssignOrganizationRole,
  canManageOrganizationUsers,
  canModifyOrganizationMember,
  getApiKeyCreatorRole,
  getMembershipRoleByEmail,
  getUsersQuery,
} from "../utils";

vi.mock("@/modules/api/v2/management/lib/utils", () => ({
  pickCommonFilter: vi.fn(),
  buildCommonFilterQuery: vi.fn(),
}));

vi.mock("@/lib/constants", () => ({
  USER_MANAGEMENT_MINIMUM_ROLE: "manager",
}));

vi.mock("@/lib/membership/utils", () => ({
  getUserManagementAccess: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    apiKey: {
      findUnique: vi.fn(),
    },
    membership: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

describe("getUsersQuery", () => {
  test("returns default query if no params are provided", () => {
    const result = getUsersQuery("org123");
    expect(result).toEqual({
      where: {
        memberships: {
          some: {
            organizationId: "org123",
          },
        },
      },
    });
  });

  test("includes email filter if email param is provided", () => {
    const result = getUsersQuery("org123", { email: "test@example.com" } as TGetUsersFilter);
    expect(result.where?.email).toEqual({
      contains: "test@example.com",
      mode: "insensitive",
    });
  });

  test("includes id filter if id param is provided", () => {
    const result = getUsersQuery("org123", { id: "user123" } as TGetUsersFilter);
    expect(result.where?.id).toBe("user123");
  });

  test("applies baseFilter if pickCommonFilter returns something", () => {
    vi.mocked(pickCommonFilter).mockReturnValueOnce({ someField: "test" } as unknown as ReturnType<
      typeof pickCommonFilter
    >);
    getUsersQuery("org123", {} as TGetUsersFilter);
    expect(buildCommonFilterQuery).toHaveBeenCalled();
  });
});

describe("getApiKeyCreatorRole", () => {
  beforeEach(() => {
    vi.mocked(prisma.apiKey.findUnique).mockReset();
    vi.mocked(prisma.membership.findUnique).mockReset();
  });

  test("returns the creator's role in the organization", async () => {
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValueOnce({ createdBy: "user123" } as any);
    vi.mocked(prisma.membership.findUnique).mockResolvedValueOnce({ role: "manager" } as any);

    const result = await getApiKeyCreatorRole("apiKey123", "org123");

    expect(prisma.apiKey.findUnique).toHaveBeenCalledWith({
      where: { id: "apiKey123" },
      select: { createdBy: true },
    });
    expect(prisma.membership.findUnique).toHaveBeenCalledWith({
      where: { userId_organizationId: { userId: "user123", organizationId: "org123" } },
      select: { role: true },
    });
    expect(result).toBe("manager");
  });

  test("returns null when the api key does not exist", async () => {
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValueOnce(null as any);

    const result = await getApiKeyCreatorRole("apiKey123", "org123");

    expect(result).toBeNull();
    expect(prisma.membership.findUnique).not.toHaveBeenCalled();
  });

  test("returns null when the api key has no creator (legacy key)", async () => {
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValueOnce({ createdBy: null } as any);

    const result = await getApiKeyCreatorRole("apiKey123", "org123");

    expect(result).toBeNull();
    expect(prisma.membership.findUnique).not.toHaveBeenCalled();
  });

  test("returns null when the creator is no longer a member of the organization", async () => {
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValueOnce({ createdBy: "user123" } as any);
    vi.mocked(prisma.membership.findUnique).mockResolvedValueOnce(null as any);

    const result = await getApiKeyCreatorRole("apiKey123", "org123");

    expect(result).toBeNull();
  });
});

describe("getMembershipRoleByEmail", () => {
  beforeEach(() => {
    vi.mocked(prisma.membership.findFirst).mockReset();
  });

  test("returns the target user's role in the organization", async () => {
    vi.mocked(prisma.membership.findFirst).mockResolvedValueOnce({ role: "owner" } as any);

    const result = await getMembershipRoleByEmail("owner@example.com", "org123");

    expect(prisma.membership.findFirst).toHaveBeenCalledWith({
      where: { organizationId: "org123", user: { email: "owner@example.com" } },
      select: { role: true },
    });
    expect(result).toBe("owner");
  });

  test("returns null when the user has no membership in the organization", async () => {
    vi.mocked(prisma.membership.findFirst).mockResolvedValueOnce(null as any);

    const result = await getMembershipRoleByEmail("nobody@example.com", "org123");

    expect(result).toBeNull();
  });
});

describe("canAssignOrganizationRole", () => {
  test("owner can assign any role", () => {
    expect(canAssignOrganizationRole("owner", "owner")).toBe(true);
    expect(canAssignOrganizationRole("owner", "manager")).toBe(true);
    expect(canAssignOrganizationRole("owner", "member")).toBe(true);
  });

  test("owner can change the role of an existing owner", () => {
    expect(canAssignOrganizationRole("owner", "member", "owner")).toBe(true);
    expect(canAssignOrganizationRole("owner", "manager", "owner")).toBe(true);
  });

  test("manager can only assign the member role", () => {
    expect(canAssignOrganizationRole("manager", "member")).toBe(true);
    expect(canAssignOrganizationRole("manager", "manager")).toBe(false);
    expect(canAssignOrganizationRole("manager", "owner")).toBe(false);
  });

  test("manager cannot change the role of an existing owner", () => {
    expect(canAssignOrganizationRole("manager", "member", "owner")).toBe(false);
    expect(canAssignOrganizationRole("manager", "manager", "owner")).toBe(false);
    expect(canAssignOrganizationRole("manager", "owner", "owner")).toBe(false);
  });

  test("manager can assign the member role to existing non-owners", () => {
    expect(canAssignOrganizationRole("manager", "member", "member")).toBe(true);
    expect(canAssignOrganizationRole("manager", "member", "manager")).toBe(true);
    expect(canAssignOrganizationRole("manager", "member", null)).toBe(true);
  });

  test("member cannot assign any role", () => {
    expect(canAssignOrganizationRole("member", "member")).toBe(false);
    expect(canAssignOrganizationRole("member", "owner")).toBe(false);
  });

  test("an unresolved creator cannot assign any role", () => {
    expect(canAssignOrganizationRole(null, "member")).toBe(false);
    expect(canAssignOrganizationRole(null, "owner")).toBe(false);
  });
});

describe("canModifyOrganizationMember", () => {
  test("owner can modify any member, including another owner", () => {
    expect(canModifyOrganizationMember("owner", "owner")).toBe(true);
    expect(canModifyOrganizationMember("owner", "manager")).toBe(true);
    expect(canModifyOrganizationMember("owner", "member")).toBe(true);
  });

  test("a non-owner cannot modify an existing owner", () => {
    expect(canModifyOrganizationMember("manager", "owner")).toBe(false);
    expect(canModifyOrganizationMember("member", "owner")).toBe(false);
    expect(canModifyOrganizationMember(null, "owner")).toBe(false);
  });

  test("a non-owner can modify non-owner members", () => {
    expect(canModifyOrganizationMember("manager", "manager")).toBe(true);
    expect(canModifyOrganizationMember("manager", "member")).toBe(true);
    expect(canModifyOrganizationMember("manager", null)).toBe(true);
  });
});

describe("canManageOrganizationUsers", () => {
  beforeEach(() => {
    vi.mocked(getUserManagementAccess).mockReset();
  });

  test("an unresolved creator (null) is denied without consulting the floor", () => {
    expect(canManageOrganizationUsers(null)).toBe(false);
    expect(getUserManagementAccess).not.toHaveBeenCalled();
  });

  test("delegates to getUserManagementAccess with the configured minimum role", () => {
    vi.mocked(getUserManagementAccess).mockReturnValue(true);
    expect(canManageOrganizationUsers("manager")).toBe(true);
    expect(getUserManagementAccess).toHaveBeenCalledWith("manager", "manager");
  });

  test("denies when the creator's role is below the configured floor", () => {
    vi.mocked(getUserManagementAccess).mockReturnValue(false);
    expect(canManageOrganizationUsers("manager")).toBe(false);
  });
});
