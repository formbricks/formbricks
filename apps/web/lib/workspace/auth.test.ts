import { beforeEach, describe, expect, test, vi } from "vitest";
import { hasUserWorkspaceAccessForAction } from "./auth";

const mocks = vi.hoisted(() => ({
  membershipFindFirst: vi.fn(),
  workspaceTeamFindFirst: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    membership: {
      findFirst: mocks.membershipFindFirst,
    },
    workspaceTeam: {
      findFirst: mocks.workspaceTeamFindFirst,
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
  });

  test("returns false when the user has no organization membership for the workspace", async () => {
    mocks.membershipFindFirst.mockResolvedValue(null);

    expect(await hasUserWorkspaceAccessForAction(userId, workspaceId, "GET")).toBe(false);
    expect(mocks.workspaceTeamFindFirst).not.toHaveBeenCalled();
  });

  test.each(["GET", "POST", "PUT", "PATCH", "DELETE"] as const)(
    "returns false for billing role on %s",
    async (action) => {
      mocks.membershipFindFirst.mockResolvedValue({ role: "billing" });

      expect(await hasUserWorkspaceAccessForAction(userId, workspaceId, action)).toBe(false);
      expect(mocks.workspaceTeamFindFirst).not.toHaveBeenCalled();
    }
  );

  test.each(["owner", "manager"] as const)(
    "returns true for %s role on any action without consulting team permissions",
    async (role) => {
      mocks.membershipFindFirst.mockResolvedValue({ role });

      expect(await hasUserWorkspaceAccessForAction(userId, workspaceId, "DELETE")).toBe(true);
      expect(mocks.workspaceTeamFindFirst).not.toHaveBeenCalled();
    }
  );

  test("returns false for member role when no team grants workspace access", async () => {
    mocks.membershipFindFirst.mockResolvedValue({ role: "member" });
    mocks.workspaceTeamFindFirst.mockResolvedValue(null);

    expect(await hasUserWorkspaceAccessForAction(userId, workspaceId, "GET")).toBe(false);
  });

  test("member with read team permission can GET but cannot POST or DELETE", async () => {
    mocks.membershipFindFirst.mockResolvedValue({ role: "member" });
    mocks.workspaceTeamFindFirst.mockResolvedValue({ permission: "read" });

    expect(await hasUserWorkspaceAccessForAction(userId, workspaceId, "GET")).toBe(true);
    expect(await hasUserWorkspaceAccessForAction(userId, workspaceId, "POST")).toBe(false);
    expect(await hasUserWorkspaceAccessForAction(userId, workspaceId, "DELETE")).toBe(false);
  });

  test("member with readWrite team permission can GET and POST but cannot DELETE", async () => {
    mocks.membershipFindFirst.mockResolvedValue({ role: "member" });
    mocks.workspaceTeamFindFirst.mockResolvedValue({ permission: "readWrite" });

    expect(await hasUserWorkspaceAccessForAction(userId, workspaceId, "GET")).toBe(true);
    expect(await hasUserWorkspaceAccessForAction(userId, workspaceId, "POST")).toBe(true);
    expect(await hasUserWorkspaceAccessForAction(userId, workspaceId, "PATCH")).toBe(true);
    expect(await hasUserWorkspaceAccessForAction(userId, workspaceId, "DELETE")).toBe(false);
  });

  test("member with manage team permission can perform any action", async () => {
    mocks.membershipFindFirst.mockResolvedValue({ role: "member" });
    mocks.workspaceTeamFindFirst.mockResolvedValue({ permission: "manage" });

    expect(await hasUserWorkspaceAccessForAction(userId, workspaceId, "GET")).toBe(true);
    expect(await hasUserWorkspaceAccessForAction(userId, workspaceId, "POST")).toBe(true);
    expect(await hasUserWorkspaceAccessForAction(userId, workspaceId, "DELETE")).toBe(true);
  });
});
