import { beforeEach, describe, expect, test, vi } from "vitest";
import { hasUserWorkspaceAccessForAction } from "./auth";

const mocks = vi.hoisted(() => ({
  membershipFindFirst: vi.fn(),
  workspaceTeamFindMany: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    membership: {
      findFirst: mocks.membershipFindFirst,
    },
    workspaceTeam: {
      findMany: mocks.workspaceTeamFindMany,
    },
  },
}));

vi.mock("../utils/validate", () => ({
  validateInputs: vi.fn(),
}));

describe("hasUserWorkspaceAccessForAction", () => {
  const userId = "00000000-0000-0000-0000-000000000001";
  const workspaceId = "00000000-0000-0000-0000-000000000002";

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.workspaceTeamFindMany.mockResolvedValue([]);
  });

  test("returns false when the user has no organization membership for the workspace", async () => {
    mocks.membershipFindFirst.mockResolvedValue(null);

    expect(await hasUserWorkspaceAccessForAction(userId, workspaceId, "GET")).toBe(false);
    expect(mocks.workspaceTeamFindMany).not.toHaveBeenCalled();
  });

  test.each(["GET", "POST", "PUT", "PATCH", "DELETE"] as const)(
    "returns false for billing role on %s",
    async (action) => {
      mocks.membershipFindFirst.mockResolvedValue({ role: "billing" });

      expect(await hasUserWorkspaceAccessForAction(userId, workspaceId, action)).toBe(false);
      expect(mocks.workspaceTeamFindMany).not.toHaveBeenCalled();
    }
  );

  test.each(["owner", "manager"] as const)(
    "returns true for %s role on any action without consulting team permissions",
    async (role) => {
      mocks.membershipFindFirst.mockResolvedValue({ role });

      expect(await hasUserWorkspaceAccessForAction(userId, workspaceId, "DELETE")).toBe(true);
      expect(mocks.workspaceTeamFindMany).not.toHaveBeenCalled();
    }
  );

  test("returns false for member role when no team grants workspace access", async () => {
    mocks.membershipFindFirst.mockResolvedValue({ role: "member" });
    mocks.workspaceTeamFindMany.mockResolvedValue([]);

    expect(await hasUserWorkspaceAccessForAction(userId, workspaceId, "GET")).toBe(false);
  });

  test("member with read team permission can GET but cannot POST or DELETE", async () => {
    mocks.membershipFindFirst.mockResolvedValue({ role: "member" });
    mocks.workspaceTeamFindMany.mockResolvedValue([{ permission: "read" }]);

    expect(await hasUserWorkspaceAccessForAction(userId, workspaceId, "GET")).toBe(true);
    expect(await hasUserWorkspaceAccessForAction(userId, workspaceId, "POST")).toBe(false);
    expect(await hasUserWorkspaceAccessForAction(userId, workspaceId, "DELETE")).toBe(false);
  });

  test("member with readWrite team permission can GET/POST/PUT/PATCH but cannot DELETE", async () => {
    mocks.membershipFindFirst.mockResolvedValue({ role: "member" });
    mocks.workspaceTeamFindMany.mockResolvedValue([{ permission: "readWrite" }]);

    expect(await hasUserWorkspaceAccessForAction(userId, workspaceId, "GET")).toBe(true);
    expect(await hasUserWorkspaceAccessForAction(userId, workspaceId, "POST")).toBe(true);
    expect(await hasUserWorkspaceAccessForAction(userId, workspaceId, "PUT")).toBe(true);
    expect(await hasUserWorkspaceAccessForAction(userId, workspaceId, "PATCH")).toBe(true);
    expect(await hasUserWorkspaceAccessForAction(userId, workspaceId, "DELETE")).toBe(false);
  });

  test("member with manage team permission can perform any action", async () => {
    mocks.membershipFindFirst.mockResolvedValue({ role: "member" });
    mocks.workspaceTeamFindMany.mockResolvedValue([{ permission: "manage" }]);

    expect(await hasUserWorkspaceAccessForAction(userId, workspaceId, "GET")).toBe(true);
    expect(await hasUserWorkspaceAccessForAction(userId, workspaceId, "POST")).toBe(true);
    expect(await hasUserWorkspaceAccessForAction(userId, workspaceId, "DELETE")).toBe(true);
  });

  test("member in multiple teams uses the highest permission across them", async () => {
    mocks.membershipFindFirst.mockResolvedValue({ role: "member" });
    mocks.workspaceTeamFindMany.mockResolvedValue([
      { permission: "read" },
      { permission: "manage" },
      { permission: "readWrite" },
    ]);

    expect(await hasUserWorkspaceAccessForAction(userId, workspaceId, "DELETE")).toBe(true);
  });

  test("member in multiple teams none of which grant sufficient permission is denied", async () => {
    mocks.membershipFindFirst.mockResolvedValue({ role: "member" });
    mocks.workspaceTeamFindMany.mockResolvedValue([{ permission: "read" }, { permission: "readWrite" }]);

    expect(await hasUserWorkspaceAccessForAction(userId, workspaceId, "GET")).toBe(true);
    expect(await hasUserWorkspaceAccessForAction(userId, workspaceId, "POST")).toBe(true);
    expect(await hasUserWorkspaceAccessForAction(userId, workspaceId, "DELETE")).toBe(false);
  });
});
