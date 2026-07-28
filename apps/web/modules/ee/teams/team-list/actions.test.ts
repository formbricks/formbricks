import { beforeEach, describe, expect, test, vi } from "vitest";
import { assertCan } from "@/lib/authorization";
import { createTeamAction, deleteTeamAction, getTeamDetailsAction, updateTeamDetailsAction } from "./actions";

const mocks = vi.hoisted(() => ({
  checkRoleManagementPermission: vi.fn(),
  createTeam: vi.fn(),
  deleteTeam: vi.fn(),
  getOrganizationIdFromTeamId: vi.fn(),
  getTeamDetails: vi.fn(),
  updateTeamDetails: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({
  assertCan: vi.fn(),
}));

vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: vi.fn(() => ({
      action: vi.fn((fn) => fn),
    })),
  },
}));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromTeamId: mocks.getOrganizationIdFromTeamId,
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_eventName, _objectType, fn) => fn),
}));

vi.mock("@/modules/ee/role-management/actions", () => ({
  checkRoleManagementPermission: mocks.checkRoleManagementPermission,
}));

vi.mock("@/modules/ee/teams/lib/roles", () => ({
  getTeamRoleByTeamIdUserId: vi.fn(),
}));

vi.mock("@/modules/ee/teams/team-list/lib/team", () => ({
  createTeam: mocks.createTeam,
  deleteTeam: mocks.deleteTeam,
  getTeamDetails: mocks.getTeamDetails,
  updateTeamDetails: mocks.updateTeamDetails,
}));

describe("team-list authorization", () => {
  const organizationId = "org-1";
  const teamId = "team-1";
  const ctx = { user: { id: "user-1" }, auditLoggingCtx: {} };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrganizationIdFromTeamId.mockResolvedValue(organizationId);
    mocks.createTeam.mockResolvedValue(teamId);
    mocks.getTeamDetails.mockResolvedValue({ id: teamId, name: "Team" });
  });

  test("requires organization.manage to create a team", async () => {
    await createTeamAction({
      ctx,
      parsedInput: { organizationId, name: "Team" },
    } as never);

    expect(assertCan).toHaveBeenCalledWith({ type: "user", id: "user-1" }, "organization.manage", {
      type: "organization",
      id: organizationId,
    });
    expect(mocks.checkRoleManagementPermission).toHaveBeenCalledWith(organizationId);
  });

  test.each([
    ["read details", getTeamDetailsAction, { teamId }],
    ["update", updateTeamDetailsAction, { teamId, data: { name: "Updated" } }],
  ] as const)("requires team.manage to %s", async (_name, action, parsedInput) => {
    await action({ ctx, parsedInput } as never);

    expect(assertCan).toHaveBeenCalledWith({ type: "user", id: "user-1" }, "team.manage", {
      type: "team",
      id: teamId,
    });
  });

  test("requires team.delete to delete a team", async () => {
    await deleteTeamAction({ ctx, parsedInput: { teamId } } as never);

    expect(assertCan).toHaveBeenCalledWith({ type: "user", id: "user-1" }, "team.delete", {
      type: "team",
      id: teamId,
    });
  });

  test("preserves entitlement checks after authorization", async () => {
    const callOrder: string[] = [];
    vi.mocked(assertCan).mockImplementation(async () => {
      callOrder.push("authorize");
    });
    mocks.checkRoleManagementPermission.mockImplementation(async () => {
      callOrder.push("entitlement");
    });

    await createTeamAction({
      ctx,
      parsedInput: { organizationId, name: "Team" },
    } as never);

    expect(callOrder).toEqual(["authorize", "entitlement"]);
  });
});
