import { beforeEach, describe, expect, test, vi } from "vitest";
import { can } from "@/lib/authorization";
import { validateInputs } from "../utils/validate";
import { hasUserWorkspaceAccess, hasUserWorkspaceAccessForAction } from "./auth";

const mocks = vi.hoisted(() => ({
  membershipFindFirst: vi.fn(),
  teamUserFindFirst: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({
  can: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    membership: { findFirst: mocks.membershipFindFirst },
    teamUser: { findFirst: mocks.teamUserFindFirst },
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
    vi.mocked(can).mockResolvedValue(true);
  });

  test.each([
    ["GET", "workspace.read"],
    ["POST", "workspace.write"],
    ["PUT", "workspace.write"],
    ["PATCH", "workspace.write"],
    ["DELETE", "workspace.manage"],
  ] as const)("maps %s to %s", async (method, action) => {
    await expect(hasUserWorkspaceAccessForAction(userId, workspaceId, method)).resolves.toBe(true);

    expect(validateInputs).toHaveBeenCalledWith(
      [userId, expect.anything()],
      [workspaceId, expect.anything()]
    );
    expect(can).toHaveBeenCalledWith({ type: "user", id: userId }, action, {
      type: "workspace",
      id: workspaceId,
    });
  });

  test("returns the central authorization denial", async () => {
    vi.mocked(can).mockResolvedValue(false);

    await expect(hasUserWorkspaceAccessForAction(userId, workspaceId, "GET")).resolves.toBe(false);
  });

  test("propagates central evaluator failures", async () => {
    vi.mocked(can).mockRejectedValue(new Error("database unavailable"));

    await expect(hasUserWorkspaceAccessForAction(userId, workspaceId, "GET")).rejects.toThrow(
      "database unavailable"
    );
  });
});

describe("hasUserWorkspaceAccess navigation compatibility", () => {
  const userId = "00000000-0000-0000-0000-000000000001";
  const workspaceId = "00000000-0000-0000-0000-000000000002";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("preserves billing-role navigation access", async () => {
    mocks.membershipFindFirst.mockResolvedValue({ role: "billing" });

    await expect(hasUserWorkspaceAccess(userId, workspaceId)).resolves.toBe(true);

    expect(can).not.toHaveBeenCalled();
    expect(mocks.teamUserFindFirst).not.toHaveBeenCalled();
  });

  test("preserves member navigation access through any workspace team", async () => {
    mocks.membershipFindFirst.mockResolvedValue({ role: "member" });
    mocks.teamUserFindFirst.mockResolvedValue({ userId });

    await expect(hasUserWorkspaceAccess(userId, workspaceId)).resolves.toBe(true);
  });
});
