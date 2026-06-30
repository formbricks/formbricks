import { redirect } from "next/navigation";
import { describe, expect, test, vi } from "vitest";
import { getBillingFallbackPath } from "@/lib/membership/navigation";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { redirectBillingRoleFromRestrictedSettings } from "./redirect-billing-role";

const mocks = vi.hoisted(() => ({
  getBillingFallbackPath: vi.fn(),
  getWorkspaceAuth: vi.fn(),
  isFormbricksCloud: false,
}));

vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: mocks.isFormbricksCloud,
}));

vi.mock("@/lib/membership/navigation", () => ({
  getBillingFallbackPath: mocks.getBillingFallbackPath,
}));

vi.mock("@/modules/workspaces/lib/utils", () => ({
  getWorkspaceAuth: mocks.getWorkspaceAuth,
}));

const workspaceId = "workspace-1";
const organizationId = "organization-1";
const billingFallbackPath = `/organizations/${organizationId}/settings/billing`;

const getWorkspaceAuthResponse = (isBilling: boolean) =>
  ({
    isBilling,
    organization: { id: organizationId },
  }) as Awaited<ReturnType<typeof getWorkspaceAuth>>;

describe("redirectBillingRoleFromRestrictedSettings", () => {
  test("does not redirect non-billing workspace members", async () => {
    vi.mocked(getWorkspaceAuth).mockResolvedValue(getWorkspaceAuthResponse(false));

    await expect(redirectBillingRoleFromRestrictedSettings(workspaceId)).resolves.toBeUndefined();

    expect(getWorkspaceAuth).toHaveBeenCalledWith(workspaceId);
    expect(getBillingFallbackPath).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  test("redirects billing users to the billing fallback path", async () => {
    vi.mocked(getWorkspaceAuth).mockResolvedValue(getWorkspaceAuthResponse(true));
    vi.mocked(getBillingFallbackPath).mockReturnValue(billingFallbackPath);

    await redirectBillingRoleFromRestrictedSettings(workspaceId);

    expect(getWorkspaceAuth).toHaveBeenCalledWith(workspaceId);
    expect(getBillingFallbackPath).toHaveBeenCalledWith(organizationId, mocks.isFormbricksCloud);
    expect(redirect).toHaveBeenCalledWith(billingFallbackPath);
  });
});
