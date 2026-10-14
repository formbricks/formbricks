import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError, OperationNotAllowedError } from "@formbricks/types/errors";
import { createWorkspaceAction } from "./actions";

const mocks = vi.hoisted(() => ({
  assertCan: vi.fn(),
  applyRateLimit: vi.fn(),
  getOrganization: vi.fn(),
  getOrganizationWorkspacesLimit: vi.fn(),
  getOrganizationWorkspacesCount: vi.fn(),
  getAccessControlPermission: vi.fn(),
  createWorkspace: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: vi.fn(() => ({
      action: vi.fn((fn) => fn),
    })),
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
}));
vi.mock("@/modules/workspaces/settings/lib/workspace", () => ({ createWorkspace: mocks.createWorkspace }));
vi.mock("@/lib/user/service", () => ({ updateUser: mocks.updateUser }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn(), groupIdentifyPostHog: vi.fn() }));
vi.mock("./lib/organization", () => ({ getOrganizationsByUserId: vi.fn() }));
vi.mock("./lib/workspace", () => ({
  getWorkspacesByUserId: vi.fn(),
  getWritableWorkspacesByUserId: vi.fn(),
}));

const ORGANIZATION_ID = "org-1";

const runCreateWorkspace = () =>
  (createWorkspaceAction as unknown as (a: unknown) => Promise<unknown>)({
    ctx: { user: { id: "user-1", notificationSettings: {} }, auditLoggingCtx: {} },
    parsedInput: { organizationId: ORGANIZATION_ID, data: { name: "New workspace" } },
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.assertCan.mockResolvedValue(undefined);
  mocks.getOrganization.mockResolvedValue({ id: ORGANIZATION_ID });
  mocks.getOrganizationWorkspacesLimit.mockResolvedValue(3);
  mocks.getOrganizationWorkspacesCount.mockResolvedValue(2);
  mocks.createWorkspace.mockResolvedValue({ id: "ws-new", name: "New workspace" });
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
});
