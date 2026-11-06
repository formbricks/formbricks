import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError, OperationNotAllowedError } from "@formbricks/types/errors";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { listDashboardViewerOrganizations } from "@/modules/ee/analysis/lib/dashboard-viewer-access";
import { createWorkspaceAction, getOrganizationsForSwitcherAction } from "./actions";
import { getOrganizationsByUserId } from "./lib/organization";

const mocks = vi.hoisted(() => ({
  assertCan: vi.fn(),
  applyRateLimit: vi.fn(),
  getOrganization: vi.fn(),
  getOrganizationWorkspacesLimit: vi.fn(),
  getOrganizationWorkspacesCount: vi.fn(),
  getAccessControlPermission: vi.fn(),
  getRemoveBrandingPermission: vi.fn(),
  createWorkspace: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: vi.fn(() => ({
      action: vi.fn((fn) => fn),
    })),
    action: vi.fn((fn) => fn),
  },
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_eventName, _objectType, fn) => fn),
}));
vi.mock("@/lib/authorization", () => ({ assertCan: mocks.assertCan }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/lib/organization/service", () => ({ getOrganization: mocks.getOrganization }));
vi.mock("@/lib/workspace/service", () => ({
  getOrganizationWorkspacesCount: mocks.getOrganizationWorkspacesCount,
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getAccessControlPermission: mocks.getAccessControlPermission,
  getOrganizationWorkspacesLimit: mocks.getOrganizationWorkspacesLimit,
  getRemoveBrandingPermission: mocks.getRemoveBrandingPermission,
}));
vi.mock("@/modules/workspaces/settings/lib/workspace", () => ({ createWorkspace: mocks.createWorkspace }));
vi.mock("@/lib/user/service", () => ({ updateUser: mocks.updateUser }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn(), groupIdentifyPostHog: vi.fn() }));
vi.mock("./lib/organization", () => ({ getOrganizationsByUserId: vi.fn() }));
vi.mock("@/lib/membership/service", () => ({ getMembershipByUserIdOrganizationId: vi.fn() }));
vi.mock("@/modules/ee/analysis/lib/dashboard-viewer-access", () => ({
  listDashboardViewerOrganizations: vi.fn(),
  listDashboardViewerWorkspaces: vi.fn(),
}));
vi.mock("./lib/workspace", () => ({
  getWorkspacesByUserId: vi.fn(),
  getWritableWorkspacesByUserId: vi.fn(),
}));

// Read before `beforeEach` clears the mocks: which actions were defined without an input schema.
const actionsWithoutInput = vi.mocked(authenticatedActionClient.action).mock.calls.map(([fn]) => fn);

const ORGANIZATION_ID = "org-1";

const runCreateWorkspace = (data: Record<string, unknown> = { name: "New workspace" }) =>
  (createWorkspaceAction as unknown as (a: unknown) => Promise<unknown>)({
    ctx: { user: { id: "user-1", notificationSettings: {} }, auditLoggingCtx: {} },
    parsedInput: { organizationId: ORGANIZATION_ID, data },
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.assertCan.mockResolvedValue(undefined);
  mocks.getOrganization.mockResolvedValue({ id: ORGANIZATION_ID });
  mocks.getOrganizationWorkspacesLimit.mockResolvedValue(3);
  mocks.getOrganizationWorkspacesCount.mockResolvedValue(2);
  mocks.createWorkspace.mockResolvedValue({ id: "ws-new", name: "New workspace" });
  mocks.getRemoveBrandingPermission.mockResolvedValue(false);
});

// The cap itself is enforced under a lock inside createWorkspace (ENG-3921); these cover what the
// action adds around it.
describe("createWorkspaceAction", () => {
  test("rate-limits only after authorization, so a non-member cannot spend the organization's budget", async () => {
    mocks.assertCan.mockRejectedValue(new AuthorizationError("Not authorized"));

    await expect(runCreateWorkspace()).rejects.toThrow(AuthorizationError);
    expect(mocks.applyRateLimit).not.toHaveBeenCalled();
    expect(mocks.createWorkspace).not.toHaveBeenCalled();
  });

  test("rejects early at the limit without opening the transaction", async () => {
    mocks.getOrganizationWorkspacesCount.mockResolvedValue(3);

    await expect(runCreateWorkspace()).rejects.toThrow(OperationNotAllowedError);
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "action:state-mutation" }),
      ORGANIZATION_ID
    );
    expect(mocks.createWorkspace).not.toHaveBeenCalled();
  });

  test("passes the resolved limit to createWorkspace, which enforces it", async () => {
    await runCreateWorkspace();

    expect(mocks.createWorkspace).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      { name: "New workspace" },
      { workspaceLimit: 3 }
    );
  });

  // ENG-6840: create accepted the branding fields without the licence the update path asks for.
  describe("branding at creation", () => {
    test.each([
      ["in-app", { inAppSurveyBranding: false }],
      ["link survey", { linkSurveyBranding: false }],
    ])("refuses %s branding removal without the remove-branding licence", async (_kind, branding) => {
      await expect(runCreateWorkspace({ name: "New workspace", ...branding })).rejects.toThrow(
        OperationNotAllowedError
      );
      expect(mocks.getRemoveBrandingPermission).toHaveBeenCalledWith(ORGANIZATION_ID);
      expect(mocks.createWorkspace).not.toHaveBeenCalled();
    });

    test("allows it with the licence", async () => {
      mocks.getRemoveBrandingPermission.mockResolvedValue(true);
      const data = { name: "New workspace", inAppSurveyBranding: false, linkSurveyBranding: false };

      await runCreateWorkspace(data);

      expect(mocks.createWorkspace).toHaveBeenCalledWith(ORGANIZATION_ID, data, { workspaceLimit: 3 });
    });

    test("does not ask for the licence when no branding is set, as the create modal sends it", async () => {
      await runCreateWorkspace({ name: "New workspace", teamIds: [] });

      expect(mocks.getRemoveBrandingPermission).not.toHaveBeenCalled();
      expect(mocks.createWorkspace).toHaveBeenCalled();
    });
  });
});

describe("getOrganizationsForSwitcherAction", () => {
  const run = () =>
    (getOrganizationsForSwitcherAction as unknown as (a: unknown) => Promise<unknown>)({
      ctx: { user: { id: "user-1" } },
    });

  test("takes no input: the list is scoped by the signed-in user alone", () => {
    // Defined through `.action` directly, without an input schema.
    expect(actionsWithoutInput).toContain(getOrganizationsForSwitcherAction);
  });

  test("answers the caller's own organizations, viewer ones included, with no role-based gate", async () => {
    vi.mocked(getOrganizationsByUserId).mockResolvedValue([{ id: "org-1", name: "A" }]);
    vi.mocked(listDashboardViewerOrganizations).mockResolvedValue([
      { id: "org-1", name: "A" },
      { id: "org-2", name: "B" },
    ]);

    await expect(run()).resolves.toEqual([
      { id: "org-1", name: "A" },
      { id: "org-2", name: "B" },
    ]);
    expect(getOrganizationsByUserId).toHaveBeenCalledWith("user-1");
    expect(listDashboardViewerOrganizations).toHaveBeenCalledWith("user-1");
    // Scoped by the user, so nothing is gated by role.
    expect(mocks.assertCan).not.toHaveBeenCalled();
  });
});
