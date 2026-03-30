import { beforeEach, describe, expect, test, vi } from "vitest";
import { hasCloudEntitlement, hasCloudEntitlementWithLicenseGuard } from "./feature-access";

const mocks = vi.hoisted(() => ({
  isCloud: true,
  hasOrganizationEntitlement: vi.fn(),
  hasOrganizationEntitlementWithLicenseGuard: vi.fn(),
}));

vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/constants")>();
  return {
    ...actual,
    get IS_FORMBRICKS_CLOUD() {
      return mocks.isCloud;
    },
  };
});

vi.mock("@/modules/entitlements/lib/checks", () => ({
  hasOrganizationEntitlement: mocks.hasOrganizationEntitlement,
  hasOrganizationEntitlementWithLicenseGuard: mocks.hasOrganizationEntitlementWithLicenseGuard,
}));

describe("feature-access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isCloud = true;
    mocks.hasOrganizationEntitlement.mockResolvedValue(false);
    mocks.hasOrganizationEntitlementWithLicenseGuard.mockResolvedValue(false);
  });

  test("hasCloudEntitlement returns false outside cloud mode", async () => {
    mocks.isCloud = false;

    const result = await hasCloudEntitlement("org_1", "custom-links-in-surveys");

    expect(result).toBe(false);
    expect(mocks.hasOrganizationEntitlement).not.toHaveBeenCalled();
  });

  test("hasCloudEntitlement returns delegated value in cloud mode", async () => {
    mocks.hasOrganizationEntitlement.mockResolvedValueOnce(true);

    const result = await hasCloudEntitlement("org_1", "custom-links-in-surveys");

    expect(result).toBe(true);
    expect(mocks.hasOrganizationEntitlement).toHaveBeenCalledWith("org_1", "custom-links-in-surveys");
  });

  test("hasCloudEntitlementWithLicenseGuard returns false outside cloud mode", async () => {
    mocks.isCloud = false;

    const result = await hasCloudEntitlementWithLicenseGuard("org_1", "rbac");

    expect(result).toBe(false);
    expect(mocks.hasOrganizationEntitlementWithLicenseGuard).not.toHaveBeenCalled();
  });

  test("hasCloudEntitlementWithLicenseGuard returns delegated value in cloud mode", async () => {
    mocks.hasOrganizationEntitlementWithLicenseGuard.mockResolvedValueOnce(true);

    const result = await hasCloudEntitlementWithLicenseGuard("org_1", "rbac");

    expect(result).toBe(true);
    expect(mocks.hasOrganizationEntitlementWithLicenseGuard).toHaveBeenCalledWith("org_1", "rbac");
  });

  test("hasCloudEntitlementWithLicenseGuard propagates errors from entitlement checks", async () => {
    mocks.hasOrganizationEntitlementWithLicenseGuard.mockRejectedValueOnce(
      new Error("entitlement check failed")
    );

    await expect(hasCloudEntitlementWithLicenseGuard("org_1", "rbac")).rejects.toThrow(
      "entitlement check failed"
    );
  });
});
