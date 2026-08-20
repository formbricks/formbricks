import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError } from "@formbricks/types/errors";
import { assertCan } from "@/lib/authorization";
import { getTeamsByOrganizationIdAction, updateWorkspaceAction } from "./actions";

const mocks = vi.hoisted(() => ({
  getOrganization: vi.fn(),
  getOrganizationIdFromWorkspaceId: vi.fn(),
  getRemoveBrandingPermission: vi.fn(),
  getTeamsByOrganizationId: vi.fn(),
  getWorkspace: vi.fn(),
  updateWorkspace: vi.fn(),
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

vi.mock("@/lib/organization/service", () => ({
  getOrganization: mocks.getOrganization,
}));

vi.mock("@/lib/posthog", () => ({
  capturePostHogEvent: vi.fn(),
}));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: mocks.getOrganizationIdFromWorkspaceId,
}));

vi.mock("@/lib/workspace/service", () => ({
  getWorkspace: mocks.getWorkspace,
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_eventName, _objectType, fn) => fn),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getRemoveBrandingPermission: mocks.getRemoveBrandingPermission,
}));

vi.mock("@/modules/ee/teams/team-list/lib/team", () => ({
  getTeamsByOrganizationId: mocks.getTeamsByOrganizationId,
}));

vi.mock("@/modules/workspaces/settings/lib/workspace", () => ({
  updateWorkspace: mocks.updateWorkspace,
}));

describe("workspace settings authorization", () => {
  const organizationId = "org-1";
  const workspaceId = "workspace-1";
  const ctx = { user: { id: "user-1" }, auditLoggingCtx: {} };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrganizationIdFromWorkspaceId.mockResolvedValue(organizationId);
    mocks.getWorkspace.mockResolvedValue({ id: workspaceId, name: "Old name" });
    mocks.updateWorkspace.mockResolvedValue({ id: workspaceId, name: "New name" });
    mocks.getTeamsByOrganizationId.mockResolvedValue([]);
  });

  test("requires workspace.manage for workspace updates", async () => {
    await updateWorkspaceAction({
      ctx,
      parsedInput: { workspaceId, data: { name: "New name" } },
    } as never);

    expect(assertCan).toHaveBeenCalledWith({ type: "user", id: "user-1" }, "workspace.manage", {
      type: "workspace",
      id: workspaceId,
    });
    expect(mocks.updateWorkspace).toHaveBeenCalledWith(workspaceId, { name: "New name" });
  });

  test("does not update the workspace when authorization fails", async () => {
    const authorizationError = new AuthorizationError("Not authorized");
    vi.mocked(assertCan).mockRejectedValueOnce(authorizationError);

    await expect(
      updateWorkspaceAction({
        ctx,
        parsedInput: { workspaceId, data: { name: "New name" } },
      } as never)
    ).rejects.toBe(authorizationError);

    expect(mocks.getWorkspace).not.toHaveBeenCalled();
    expect(mocks.updateWorkspace).not.toHaveBeenCalled();
  });

  test("requires organization.manage to list teams for workspace settings", async () => {
    await getTeamsByOrganizationIdAction({
      ctx,
      parsedInput: { organizationId },
    } as never);

    expect(assertCan).toHaveBeenCalledWith({ type: "user", id: "user-1" }, "organization.manage", {
      type: "organization",
      id: organizationId,
    });
  });

  test("does not list teams when authorization fails", async () => {
    const authorizationError = new AuthorizationError("Not authorized");
    vi.mocked(assertCan).mockRejectedValueOnce(authorizationError);

    await expect(
      getTeamsByOrganizationIdAction({
        ctx,
        parsedInput: { organizationId },
      } as never)
    ).rejects.toBe(authorizationError);

    expect(mocks.getTeamsByOrganizationId).not.toHaveBeenCalled();
  });
});
