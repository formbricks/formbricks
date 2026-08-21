import { beforeEach, describe, expect, test, vi } from "vitest";
import { can } from "@/lib/authorization";
import { validateInputs } from "../utils/validate";
import {
  canUserNavigateWorkspace,
  canUserReadWorkspaceIntegrations,
  canUserWriteWorkspaceIntegrations,
} from "./auth";

vi.mock("@/lib/authorization", () => ({
  can: vi.fn(),
}));

vi.mock("../utils/validate", () => ({
  validateInputs: vi.fn(),
}));

describe("workspace integration authorization", () => {
  const userId = "00000000-0000-0000-0000-000000000001";
  const workspaceId = "00000000-0000-0000-0000-000000000002";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(can).mockResolvedValue(true);
  });

  test.each([
    ["read", canUserReadWorkspaceIntegrations, "workspace.read"],
    ["write", canUserWriteWorkspaceIntegrations, "workspace.write"],
  ] as const)("uses the semantic workspace %s action", async (_name, authorize, action) => {
    await expect(authorize(userId, workspaceId)).resolves.toBe(true);

    expect(validateInputs).toHaveBeenCalledWith(
      [userId, expect.anything()],
      [workspaceId, expect.anything()]
    );
    expect(can).toHaveBeenCalledWith({ type: "user", id: userId }, action, {
      type: "workspace",
      id: workspaceId,
    });
  });

  test("returns a central authorization denial", async () => {
    vi.mocked(can).mockResolvedValue(false);

    await expect(canUserReadWorkspaceIntegrations(userId, workspaceId)).resolves.toBe(false);
  });

  test("propagates central evaluator failures", async () => {
    vi.mocked(can).mockRejectedValue(new Error("database unavailable"));

    await expect(canUserReadWorkspaceIntegrations(userId, workspaceId)).rejects.toThrow(
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

  // Pins the composition, not a live gap: today's legacy evaluator already refuses a non-member
  // inside `workspace.read`, so this case is unreachable through it. It matters for the SpiceDB
  // definition, where `reader_team` is a projected edge carrying no membership requirement — see
  // the note on canUserNavigateWorkspace. The real-database matrix in
  // navigation-access.integration.test.ts is what proves the legacy behaviour is unchanged.
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
