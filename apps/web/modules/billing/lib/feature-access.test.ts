import { beforeEach, describe, expect, test, vi } from "vitest";
import { hasCloudEntitlement, hasCloudEntitlementWithLicenseGuard } from "./feature-access";

const mocks = vi.hoisted(() => ({
  isCloud: true,
  getBilling: vi.fn(),
  getEnterpriseLicense: vi.fn(),
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

vi.mock("./organization-billing", () => ({
  getOrganizationBillingWithReadThroughSync: mocks.getBilling,
}));

vi.mock("@/modules/ee/license-check/lib/license", () => ({
  getEnterpriseLicense: mocks.getEnterpriseLicense,
}));

describe("feature-access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isCloud = true;
    mocks.getBilling.mockResolvedValue(null);
    mocks.getEnterpriseLicense.mockResolvedValue({ active: true });
  });

  test("hasCloudEntitlement returns false outside cloud mode", async () => {
    mocks.isCloud = false;

    const result = await hasCloudEntitlement("org_1", "custom-links-in-surveys");

    expect(result).toBe(false);
    expect(mocks.getBilling).not.toHaveBeenCalled();
  });

  test("hasCloudEntitlement returns false when feature is missing", async () => {
    mocks.getBilling.mockResolvedValue({
      stripe: {
        features: ["respondent-identification"],
      },
    });

    const result = await hasCloudEntitlement("org_1", "custom-links-in-surveys");

    expect(result).toBe(false);
  });

  test("hasCloudEntitlement returns true when feature exists", async () => {
    mocks.getBilling.mockResolvedValue({
      stripe: {
        features: ["custom-links-in-surveys"],
      },
    });

    const result = await hasCloudEntitlement("org_1", "custom-links-in-surveys");

    expect(result).toBe(true);
  });

  test("hasCloudEntitlementWithLicenseGuard returns false when enterprise license is inactive", async () => {
    mocks.getEnterpriseLicense.mockResolvedValue({ active: false });

    const result = await hasCloudEntitlementWithLicenseGuard("org_1", "custom-links-in-surveys");

    expect(result).toBe(false);
    expect(mocks.getBilling).not.toHaveBeenCalled();
  });

  test("hasCloudEntitlementWithLicenseGuard returns true when license and entitlement are present", async () => {
    mocks.getBilling.mockResolvedValue({
      stripe: {
        features: ["custom-links-in-surveys"],
      },
    });

    const result = await hasCloudEntitlementWithLicenseGuard("org_1", "custom-links-in-surveys");

    expect(result).toBe(true);
  });
});
