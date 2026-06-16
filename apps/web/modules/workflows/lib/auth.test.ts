import { notFound, redirect } from "next/navigation";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getBillingFallbackPath } from "@/lib/membership/navigation";
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
};

const buildAuth = (overrides: Partial<typeof baseAuth>): TAuth =>
  ({ ...baseAuth, ...overrides }) as unknown as TAuth;

describe("getWorkflowsRouteAuth", () => {
  const workspaceId = "ws_123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("redirects to the billing fallback when the workspace is in billing", async () => {
    vi.mocked(getWorkspaceAuth).mockResolvedValue(buildAuth({ isBilling: true, isOwner: true }));

    await expect(getWorkflowsRouteAuth(workspaceId)).rejects.toThrow("NEXT_REDIRECT");
    expect(getBillingFallbackPath).toHaveBeenCalledWith(workspaceId, true);
    expect(redirect).toHaveBeenCalledWith("/billing-fallback");
    expect(notFound).not.toHaveBeenCalled();
  });

  test("calls notFound when the user has no workspace access", async () => {
    vi.mocked(getWorkspaceAuth).mockResolvedValue(buildAuth({}));

    await expect(getWorkflowsRouteAuth(workspaceId)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  test.each(["isOwner", "isManager", "hasReadAccess", "hasReadWriteAccess", "hasManageAccess"] as const)(
    "returns the auth object when %s grants access",
    async (flag) => {
      const auth = buildAuth({ [flag]: true });
      vi.mocked(getWorkspaceAuth).mockResolvedValue(auth);

      await expect(getWorkflowsRouteAuth(workspaceId)).resolves.toBe(auth);
      expect(redirect).not.toHaveBeenCalled();
      expect(notFound).not.toHaveBeenCalled();
    }
  );
});
