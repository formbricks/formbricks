import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = {
  getSession: vi.fn(),
  getOrganizationsByUserId: vi.fn(),
  getWorkspacesByUserId: vi.fn(),
  getMembershipByUserIdOrganizationId: vi.fn(),
  getOrganization: vi.fn(),
  getMonthlyOrganizationResponseCount: vi.fn(),
  getUser: vi.fn(),
  getWorkspace: vi.fn(),
  getEnterpriseLicense: vi.fn(),
  getAccessControlPermission: vi.fn(),
  getOrganizationWorkspacesLimit: vi.fn(),
  getPublicDomain: vi.fn(),
  cookieGet: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: (name: string) => mocks.cookieGet(name) }),
}));

vi.mock("@/modules/auth/lib/session", () => ({
  getSession: (...args: unknown[]) => mocks.getSession(...args),
}));
vi.mock("@/lib/constants", () => ({ IS_FORMBRICKS_CLOUD: true, IS_DEVELOPMENT: false }));
vi.mock("@/lib/getPublicUrl", () => ({ getPublicDomain: () => mocks.getPublicDomain() }));
vi.mock("@/app/(app)/workspaces/[workspaceId]/lib/organization", () => ({
  getOrganizationsByUserId: (...a: unknown[]) => mocks.getOrganizationsByUserId(...a),
}));
vi.mock("@/app/(app)/workspaces/[workspaceId]/lib/workspace", () => ({
  getWorkspacesByUserId: (...a: unknown[]) => mocks.getWorkspacesByUserId(...a),
}));
vi.mock("@/lib/membership/service", () => ({
  getMembershipByUserIdOrganizationId: (...a: unknown[]) => mocks.getMembershipByUserIdOrganizationId(...a),
}));
vi.mock("@/lib/organization/service", () => ({
  getOrganization: (...a: unknown[]) => mocks.getOrganization(...a),
  getMonthlyOrganizationResponseCount: (...a: unknown[]) => mocks.getMonthlyOrganizationResponseCount(...a),
}));
vi.mock("@/lib/user/service", () => ({ getUser: (...a: unknown[]) => mocks.getUser(...a) }));
vi.mock("@/lib/workspace/service", () => ({ getWorkspace: (...a: unknown[]) => mocks.getWorkspace(...a) }));
vi.mock("@/modules/ee/license-check/lib/license", () => ({
  getEnterpriseLicense: (...a: unknown[]) => mocks.getEnterpriseLicense(...a),
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getAccessControlPermission: (...a: unknown[]) => mocks.getAccessControlPermission(...a),
  getOrganizationWorkspacesLimit: (...a: unknown[]) => mocks.getOrganizationWorkspacesLimit(...a),
}));

const { getSettingsLayoutData } = await import("./navigation-data");

const seedSuccess = () => {
  mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
  mocks.getUser.mockResolvedValue({ id: "user-1", name: "Test" });
  mocks.getOrganization.mockResolvedValue({ id: "org-1", name: "Org", billing: {} });
  mocks.getMembershipByUserIdOrganizationId.mockResolvedValue({ role: "owner" });
  mocks.getAccessControlPermission.mockResolvedValue(true);
  mocks.getEnterpriseLicense.mockResolvedValue({ features: { isMultiOrgEnabled: true } });
  mocks.getOrganizationWorkspacesLimit.mockResolvedValue(3);
  mocks.getMonthlyOrganizationResponseCount.mockResolvedValue(42);
  mocks.getPublicDomain.mockReturnValue("https://app.formbricks.com");
  // No active-workspace cookie by default.
  mocks.cookieGet.mockReturnValue(undefined);
};

describe("getSettingsLayoutData", () => {
  afterEach(() => vi.clearAllMocks());

  test("returns null when there is no session", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect(await getSettingsLayoutData("user-1")).toBeNull();
  });

  test("returns null when no organization can be resolved", async () => {
    mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getOrganizationsByUserId.mockResolvedValue([]);
    expect(await getSettingsLayoutData("user-1")).toBeNull();
  });

  test("resolves layout data with the first workspace as current", async () => {
    seedSuccess();
    mocks.getWorkspacesByUserId.mockResolvedValue([{ id: "ws-1" }]);
    mocks.getWorkspace.mockResolvedValue({ id: "ws-1", name: "Workspace" });

    const data = await getSettingsLayoutData("user-1", "org-1");

    expect(data).not.toBeNull();
    expect(data?.organization.id).toBe("org-1");
    expect(data?.currentWorkspace?.id).toBe("ws-1");
    expect(data?.backUrl).toBe("/workspaces/ws-1/surveys");
    expect(data?.isOwnerOrManager).toBe(true);
    expect(data?.responseCount).toBe(42);
  });

  test("resolves layout data with no workspace (org/account-only)", async () => {
    seedSuccess();
    mocks.getWorkspacesByUserId.mockResolvedValue([]);

    const data = await getSettingsLayoutData("user-1", "org-1");

    expect(data?.currentWorkspace).toBeNull();
    expect(data?.backUrl).toBe("/");
  });

  test("uses the active-workspace cookie when it is in the accessible list", async () => {
    seedSuccess();
    mocks.getWorkspacesByUserId.mockResolvedValue([{ id: "ws-1" }, { id: "ws-2" }]);
    mocks.getWorkspace.mockImplementation((id: string) => Promise.resolve({ id, name: "WS" }));
    mocks.cookieGet.mockReturnValue({ value: "ws-2" });

    const data = await getSettingsLayoutData("user-1", "org-1");

    expect(data?.currentWorkspace?.id).toBe("ws-2");
    expect(data?.backUrl).toBe("/workspaces/ws-2/surveys");
  });

  test("ignores the cookie and falls back to the first workspace when it is not accessible", async () => {
    seedSuccess();
    mocks.getWorkspacesByUserId.mockResolvedValue([{ id: "ws-1" }, { id: "ws-2" }]);
    mocks.getWorkspace.mockImplementation((id: string) => Promise.resolve({ id, name: "WS" }));
    mocks.cookieGet.mockReturnValue({ value: "ws-not-mine" });

    const data = await getSettingsLayoutData("user-1", "org-1");

    expect(data?.currentWorkspace?.id).toBe("ws-1");
    expect(data?.backUrl).toBe("/workspaces/ws-1/surveys");
  });
});
