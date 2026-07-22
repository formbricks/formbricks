import { notFound, redirect } from "next/navigation";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getBillingFallbackPath } from "@/lib/membership/navigation";
import { getIsWorkflowsEnabled } from "@/modules/ee/license-check/lib/utils";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { getWorkflowsRouteAuth } from "./auth";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("@/lib/constants", () => ({ IS_FORMBRICKS_CLOUD: true }));
vi.mock("@/lib/membership/navigation", () => ({
  getBillingFallbackPath: vi.fn(() => "/billing-fallback"),
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsWorkflowsEnabled: vi.fn(),
}));
vi.mock("@/modules/workspaces/lib/utils", () => ({
  getWorkspaceAuth: vi.fn(),
}));

type TAuth = Awaited<ReturnType<typeof getWorkspaceAuth>>;

const baseAuth = {
  isBilling: false,
  isOwner: false,
  isManager: false,
  hasReadAccess: false,
  hasReadWriteAccess: false,
  hasManageAccess: false,
  isReadOnly: false,
  organization: { id: "org_123" },
};

const buildAuth = (overrides: Partial<typeof baseAuth>): TAuth =>
  ({ ...baseAuth, ...overrides }) as unknown as TAuth;

describe("getWorkflowsRouteAuth", () => {
  const workspaceId = "ws_123";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getIsWorkflowsEnabled).mockResolvedValue(true);
  });

  test("redirects to the billing fallback when the workspace is in billing", async () => {
    vi.mocked(getWorkspaceAuth).mockResolvedValue(buildAuth({ isBilling: true, isOwner: true }));

    await expect(getWorkflowsRouteAuth(workspaceId)).rejects.toThrow("NEXT_REDIRECT");
    expect(getBillingFallbackPath).toHaveBeenCalledWith("org_123", true);
    expect(redirect).toHaveBeenCalledWith("/billing-fallback");
    expect(notFound).not.toHaveBeenCalled();
  });

  test("calls notFound when the user has no workspace access", async () => {
    vi.mocked(getWorkspaceAuth).mockResolvedValue(buildAuth({}));

    await expect(getWorkflowsRouteAuth(workspaceId)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
    expect(getIsWorkflowsEnabled).not.toHaveBeenCalled();
  });

  test.each(["isOwner", "isManager", "hasReadAccess", "hasReadWriteAccess", "hasManageAccess"] as const)(
    "returns the narrow contract when %s grants access",
    async (flag) => {
      vi.mocked(getWorkspaceAuth).mockResolvedValue(buildAuth({ [flag]: true, isReadOnly: true }));

      await expect(getWorkflowsRouteAuth(workspaceId)).resolves.toEqual({
        isReadOnly: true,
        isWorkflowsEnabled: true,
        organizationId: "org_123",
      });
      expect(getIsWorkflowsEnabled).toHaveBeenCalledWith("org_123");
      expect(redirect).not.toHaveBeenCalled();
      expect(notFound).not.toHaveBeenCalled();
    }
  );

  test("returns isWorkflowsEnabled false when the organization lacks the entitlement", async () => {
    vi.mocked(getWorkspaceAuth).mockResolvedValue(buildAuth({ isOwner: true }));
    vi.mocked(getIsWorkflowsEnabled).mockResolvedValue(false);

    await expect(getWorkflowsRouteAuth(workspaceId)).resolves.toEqual({
      isReadOnly: false,
      isWorkflowsEnabled: false,
      organizationId: "org_123",
    });
  });
});
