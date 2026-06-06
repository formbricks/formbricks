import { beforeEach, describe, expect, test, vi } from "vitest";
import { invalidateOrganizationBillingCache } from "@/modules/ee/billing/lib/organization-billing";
import { refreshOnboardingBillingSnapshot } from "./refresh-onboarding-billing";

const mocks = vi.hoisted(() => ({
  isFormbricksCloud: true,
}));

vi.mock("@/lib/constants", () => ({
  get IS_FORMBRICKS_CLOUD() {
    return mocks.isFormbricksCloud;
  },
}));

vi.mock("@/modules/ee/billing/lib/organization-billing", () => ({
  invalidateOrganizationBillingCache: vi.fn(),
}));

describe("refreshOnboardingBillingSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isFormbricksCloud = true;
  });

  test("invalidates organization billing cache on cloud", async () => {
    await refreshOnboardingBillingSnapshot("org1");

    expect(invalidateOrganizationBillingCache).toHaveBeenCalledWith("org1");
  });

  test("skips billing cache invalidation when self-hosted", async () => {
    mocks.isFormbricksCloud = false;

    await refreshOnboardingBillingSnapshot("org1");

    expect(invalidateOrganizationBillingCache).not.toHaveBeenCalled();
  });
});
