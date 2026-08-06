import { beforeEach, describe, expect, test, vi } from "vitest";
import { can } from "@/lib/authorization";
import { validateInputs } from "../utils/validate";
import { canUserNavigateWorkspace, hasUserWorkspaceAccessForAction } from "./auth";

vi.mock("@/lib/authorization", () => ({
  can: vi.fn(),
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

describe("canUserNavigateWorkspace", () => {
  const userId = "00000000-0000-0000-0000-000000000001";
  const workspace = {
    id: "00000000-0000-0000-0000-000000000002",
    organizationId: "00000000-0000-0000-0000-000000000003",
  } as const;
  const actor = { type: "user", id: userId } as const;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("admits anyone who can read the workspace, without asking about billing", async () => {
    vi.mocked(can).mockResolvedValue(true);

    await expect(canUserNavigateWorkspace(userId, workspace)).resolves.toBe(true);

    expect(can).toHaveBeenCalledTimes(2);
    expect(can).toHaveBeenLastCalledWith(actor, "workspace.read", {
      type: "workspace",
      id: workspace.id,
    });
  });

  test("admits the billing role, which cannot read the workspace", async () => {
    vi.mocked(can).mockImplementation(
      async (_actor, action) => action === "organization.read" || action === "organization.manage_billing"
    );

    await expect(canUserNavigateWorkspace(userId, workspace)).resolves.toBe(true);

    expect(can).toHaveBeenLastCalledWith(actor, "organization.manage_billing", {
      type: "organization",
      id: workspace.organizationId,
    });
  });

  test("refuses an organization member with no grant for this workspace", async () => {
    vi.mocked(can).mockImplementation(async (_actor, action) => action === "organization.read");

    await expect(canUserNavigateWorkspace(userId, workspace)).resolves.toBe(false);

    expect(can).toHaveBeenCalledTimes(3);
  });

  // `TeamUser` has no foreign key to `Membership`, so a stale team row could otherwise satisfy
  // `workspace.read` for someone no longer in the organization. The helper this replaced established
  // membership with its own query first; this keeps that precondition.
  test("refuses a non-member even when a team grant would satisfy workspace.read", async () => {
    vi.mocked(can).mockImplementation(async (_actor, action) => action === "workspace.read");

    await expect(canUserNavigateWorkspace(userId, workspace)).resolves.toBe(false);

    expect(can).toHaveBeenCalledTimes(1);
    expect(can).toHaveBeenCalledWith(actor, "organization.read", {
      type: "organization",
      id: workspace.organizationId,
    });
  });

  test("propagates central evaluator failures instead of denying", async () => {
    vi.mocked(can).mockRejectedValue(new Error("database unavailable"));

    await expect(canUserNavigateWorkspace(userId, workspace)).rejects.toThrow("database unavailable");
  });
});
