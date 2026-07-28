import { beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import { hasUserWorkspaceAccessForActionLegacy } from "./legacy-workspace-access";

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

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

describe("hasUserWorkspaceAccessForActionLegacy", () => {
  const userId = "00000000-0000-0000-0000-000000000001";
  const workspaceId = "00000000-0000-0000-0000-000000000002";

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.workspaceTeamFindMany.mockResolvedValue([]);
  });

  test("returns false when the user has no organization membership for the workspace", async () => {
    mocks.membershipFindFirst.mockResolvedValue(null);

    expect(await hasUserWorkspaceAccessForActionLegacy(userId, workspaceId, "GET")).toBe(false);
    expect(mocks.workspaceTeamFindMany).not.toHaveBeenCalled();
  });

  test.each(["GET", "POST", "PUT", "PATCH", "DELETE"] as const)(
    "returns false for billing role on %s",
    async (action) => {
      mocks.membershipFindFirst.mockResolvedValue({ role: "billing" });

      expect(await hasUserWorkspaceAccessForActionLegacy(userId, workspaceId, action)).toBe(false);
      expect(mocks.workspaceTeamFindMany).not.toHaveBeenCalled();
    }
  );

  test.each(["owner", "manager"] as const)(
    "returns true for %s role on any action without consulting team permissions",
    async (role) => {
      mocks.membershipFindFirst.mockResolvedValue({ role });

      expect(await hasUserWorkspaceAccessForActionLegacy(userId, workspaceId, "DELETE")).toBe(true);
      expect(mocks.workspaceTeamFindMany).not.toHaveBeenCalled();
    }
  );

  test("returns false for member role when no team grants workspace access", async () => {
    mocks.membershipFindFirst.mockResolvedValue({ role: "member" });

    expect(await hasUserWorkspaceAccessForActionLegacy(userId, workspaceId, "GET")).toBe(false);
  });

  test.each([
    { permission: "read", allowed: ["GET"], denied: ["POST", "DELETE"] },
    { permission: "readWrite", allowed: ["GET", "POST", "PUT", "PATCH"], denied: ["DELETE"] },
    { permission: "manage", allowed: ["GET", "POST", "PUT", "PATCH", "DELETE"], denied: [] },
  ] as const)(
    "enforces the $permission workspace permission ladder",
    async ({ permission, allowed, denied }) => {
      mocks.membershipFindFirst.mockResolvedValue({ role: "member" });
      mocks.workspaceTeamFindMany.mockResolvedValue([{ permission }]);

      for (const action of allowed) {
        expect(await hasUserWorkspaceAccessForActionLegacy(userId, workspaceId, action)).toBe(true);
      }
      for (const action of denied) {
        expect(await hasUserWorkspaceAccessForActionLegacy(userId, workspaceId, action)).toBe(false);
      }
    }
  );

  test("uses the highest permission across multiple teams", async () => {
    mocks.membershipFindFirst.mockResolvedValue({ role: "member" });
    mocks.workspaceTeamFindMany.mockResolvedValue([
      { permission: "read" },
      { permission: "manage" },
      { permission: "readWrite" },
    ]);

    expect(await hasUserWorkspaceAccessForActionLegacy(userId, workspaceId, "DELETE")).toBe(true);
  });

  test("denies when none of the team grants satisfy the requested action", async () => {
    mocks.membershipFindFirst.mockResolvedValue({ role: "member" });
    mocks.workspaceTeamFindMany.mockResolvedValue([{ permission: "read" }, { permission: "readWrite" }]);

    expect(await hasUserWorkspaceAccessForActionLegacy(userId, workspaceId, "DELETE")).toBe(false);
  });

  test("wraps known Prisma errors as DatabaseError without losing the database message", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Database unavailable", {
      code: "P2024",
      clientVersion: "0.0.0",
    });
    mocks.membershipFindFirst.mockRejectedValue(prismaError);

    const caughtError = await hasUserWorkspaceAccessForActionLegacy(userId, workspaceId, "GET").catch(
      (error: unknown) => error
    );

    expect(caughtError).toBeInstanceOf(DatabaseError);
    expect(caughtError).toMatchObject({ message: prismaError.message });
    expect(mocks.workspaceTeamFindMany).not.toHaveBeenCalled();
  });
});
