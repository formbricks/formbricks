import { beforeEach, describe, expect, test, vi } from "vitest";
import * as constants from "@/lib/constants";
import { hasCloudEntitlementWithLicenseGuard } from "@/modules/billing/lib/feature-access";
import { getSurveyFollowUpsPermission } from "./utils";

vi.mock("@/lib/constants", async () => {
  const actual = (await vi.importActual("@/lib/constants")) as any;
  return {
    ...actual,
    IS_FORMBRICKS_CLOUD: true,
  };
});

vi.mock("@/modules/billing/lib/feature-access", () => ({
  hasCloudEntitlementWithLicenseGuard: vi.fn(),
}));

describe("getSurveyFollowUpsPermission", () => {
  beforeEach(() => {
    vi.spyOn(constants, "IS_FORMBRICKS_CLOUD", "get").mockReturnValue(true);
    vi.mocked(hasCloudEntitlementWithLicenseGuard).mockResolvedValue(false);
  });

  test("should return entitlement status for cloud org-aware checks", async () => {
    vi.mocked(hasCloudEntitlementWithLicenseGuard).mockResolvedValueOnce(true);

    const result = await getSurveyFollowUpsPermission("org_123");

    expect(result).toBe(true);
    expect(hasCloudEntitlementWithLicenseGuard).toHaveBeenCalledWith("org_123", "follow-ups");
  });

  test("should return false when cloud entitlement is missing", async () => {
    vi.mocked(hasCloudEntitlementWithLicenseGuard).mockResolvedValueOnce(false);

    const result = await getSurveyFollowUpsPermission("org_123");

    expect(result).toBe(false);
  });

  test("should return true for any plan when not on Formbricks Cloud", async () => {
    vi.spyOn(constants, "IS_FORMBRICKS_CLOUD", "get").mockReturnValue(false);
    const result = await getSurveyFollowUpsPermission("org_123");
    expect(result).toBe(true);
    expect(hasCloudEntitlementWithLicenseGuard).not.toHaveBeenCalled();
  });
});
