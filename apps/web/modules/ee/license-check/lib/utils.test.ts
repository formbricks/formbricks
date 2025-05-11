import { TEnterpriseLicenseFeatures } from "@/modules/ee/license-check/types/enterprise-license";
import { Organization } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  getBiggerUploadFileSizePermission,
  getIsContactsEnabled,
  getIsMultiOrgEnabled,
  getIsSamlSsoEnabled,
  getIsSpamProtectionEnabled,
  getIsSsoEnabled,
  getIsTwoFactorAuthEnabled,
  getMultiLanguagePermission,
  getOrganizationProjectsLimit,
  getRemoveBrandingPermission,
  getRoleManagementPermission,
  getWhiteLabelPermission,
} from "./utils";

// Mock the license module
const mockGetEnterpriseLicense = vi.fn();
const mockGetLicenseFeatures = vi.fn();

vi.mock("./license", () => ({
  getEnterpriseLicense: mockGetEnterpriseLicense,
  getLicenseFeatures: mockGetLicenseFeatures,
}));

// Mock constants
const mockConstants = {
  IS_FORMBRICKS_CLOUD: false,
  IS_RECAPTCHA_CONFIGURED: true,
  PROJECT_FEATURE_KEYS: {
    FREE: "free",
    BASIC: "basic",
    PRO: "pro",
    SCALE: "scale",
    ENTERPRISE: "enterprise", // Assuming this is a valid plan key
  },
};
vi.mock("@/lib/constants", () => mockConstants);

const mockOrganization = {
  billing: {
    plan: "free" as Organization["billing"]["plan"],
    limits: {
      projects: 3,
    },
  },
} as Organization;

describe("License Utils", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default mocks for active license without specific features unless overridden
    mockGetEnterpriseLicense.mockResolvedValue({
      active: true,
      features: {},
    });
    mockGetLicenseFeatures.mockResolvedValue({});
  });

  describe("getRemoveBrandingPermission", () => {
    test("should return true if license active and feature enabled (self-hosted)", async () => {
      mockConstants.IS_FORMBRICKS_CLOUD = false;
      mockGetEnterpriseLicense.mockResolvedValueOnce({ active: true, features: { removeBranding: true } });
      const result = await getRemoveBrandingPermission(mockOrganization.billing.plan);
      expect(result).toBe(true);
    });

    test("should return false if license active but feature disabled (self-hosted)", async () => {
      mockConstants.IS_FORMBRICKS_CLOUD = false;
      mockGetEnterpriseLicense.mockResolvedValueOnce({ active: true, features: { removeBranding: false } });
      const result = await getRemoveBrandingPermission(mockOrganization.billing.plan);
      expect(result).toBe(false);
    });

    test("should return true if license active and plan is not FREE (cloud)", async () => {
      mockConstants.IS_FORMBRICKS_CLOUD = true;
      mockGetEnterpriseLicense.mockResolvedValueOnce({ active: true, features: {} });
      const result = await getRemoveBrandingPermission("pro");
      expect(result).toBe(true);
    });

    test("should return false if license active and plan is FREE (cloud)", async () => {
      mockConstants.IS_FORMBRICKS_CLOUD = true;
      mockGetEnterpriseLicense.mockResolvedValueOnce({ active: true, features: {} });
      const result = await getRemoveBrandingPermission("free");
      expect(result).toBe(false);
    });

    test("should return false if license is inactive", async () => {
      mockGetEnterpriseLicense.mockResolvedValueOnce({ active: false, features: {} });
      const result = await getRemoveBrandingPermission(mockOrganization.billing.plan);
      expect(result).toBe(false);
    });
  });

  describe("getWhiteLabelPermission", () => {
    test("should return true if license active and feature enabled (self-hosted)", async () => {
      mockConstants.IS_FORMBRICKS_CLOUD = false;
      mockGetEnterpriseLicense.mockResolvedValueOnce({ active: true, features: { whitelabel: true } });
      const result = await getWhiteLabelPermission(mockOrganization.billing.plan);
      expect(result).toBe(true);
    });

    test("should return true if license active and plan is not FREE (cloud)", async () => {
      mockConstants.IS_FORMBRICKS_CLOUD = true;
      mockGetEnterpriseLicense.mockResolvedValueOnce({ active: true, features: {} });
      const result = await getWhiteLabelPermission("pro");
      expect(result).toBe(true);
    });

    test("should return false if license is inactive", async () => {
      mockGetEnterpriseLicense.mockResolvedValueOnce({ active: false, features: {} });
      const result = await getWhiteLabelPermission(mockOrganization.billing.plan);
      expect(result).toBe(false);
    });
  });

  describe("getRoleManagementPermission", () => {
    test("should return true if license active (self-hosted)", async () => {
      mockConstants.IS_FORMBRICKS_CLOUD = false;
      mockGetEnterpriseLicense.mockResolvedValueOnce({ active: true, features: {} });
      const result = await getRoleManagementPermission(mockOrganization.billing.plan);
      expect(result).toBe(true);
    });

    test("should return true if license active and plan is SCALE (cloud)", async () => {
      mockConstants.IS_FORMBRICKS_CLOUD = true;
      mockGetEnterpriseLicense.mockResolvedValueOnce({ active: true, features: {} });
      const result = await getRoleManagementPermission("scale");
      expect(result).toBe(true);
    });

    test("should return true if license active and plan is ENTERPRISE (cloud)", async () => {
      mockConstants.IS_FORMBRICKS_CLOUD = true;
      mockGetEnterpriseLicense.mockResolvedValueOnce({ active: true, features: {} });
      const result = await getRoleManagementPermission("enterprise");
      expect(result).toBe(true);
    });

    test("should return false if license active and plan is not SCALE or ENTERPRISE (cloud)", async () => {
      mockConstants.IS_FORMBRICKS_CLOUD = true;
      mockGetEnterpriseLicense.mockResolvedValueOnce({ active: true, features: {} });
      const result = await getRoleManagementPermission("pro");
      expect(result).toBe(false);
    });

    test("should return false if license is inactive", async () => {
      mockGetEnterpriseLicense.mockResolvedValueOnce({ active: false, features: {} });
      const result = await getRoleManagementPermission(mockOrganization.billing.plan);
      expect(result).toBe(false);
    });
  });

  describe("getBiggerUploadFileSizePermission", () => {
    test("should return true if license active (self-hosted)", async () => {
      mockConstants.IS_FORMBRICKS_CLOUD = false;
      mockGetEnterpriseLicense.mockResolvedValueOnce({ active: true, features: {} });
      const result = await getBiggerUploadFileSizePermission(mockOrganization.billing.plan);
      expect(result).toBe(true);
    });

    test("should return true if license active and plan is not FREE (cloud)", async () => {
      mockConstants.IS_FORMBRICKS_CLOUD = true;
      mockGetEnterpriseLicense.mockResolvedValueOnce({ active: true, features: {} });
      const result = await getBiggerUploadFileSizePermission("pro");
      expect(result).toBe(true);
    });

    test("should return false if license active and plan is FREE (cloud)", async () => {
      mockConstants.IS_FORMBRICKS_CLOUD = true;
      mockGetEnterpriseLicense.mockResolvedValueOnce({ active: true, features: {} });
      const result = await getBiggerUploadFileSizePermission("free");
      expect(result).toBe(false);
    });

    test("should return false if license is inactive", async () => {
      mockGetEnterpriseLicense.mockResolvedValueOnce({ active: false, features: {} });
      const result = await getBiggerUploadFileSizePermission(mockOrganization.billing.plan);
      expect(result).toBe(false);
    });
  });

  describe("getMultiLanguagePermission", () => {
    test("should return true if license active (self-hosted)", async () => {
      mockConstants.IS_FORMBRICKS_CLOUD = false;
      mockGetEnterpriseLicense.mockResolvedValueOnce({ active: true, features: {} });
      const result = await getMultiLanguagePermission(mockOrganization.billing.plan);
      expect(result).toBe(true);
    });

    test("should return true if license active and plan is SCALE (cloud)", async () => {
      mockConstants.IS_FORMBRICKS_CLOUD = true;
      mockGetEnterpriseLicense.mockResolvedValueOnce({ active: true, features: {} });
      const result = await getMultiLanguagePermission("scale");
      expect(result).toBe(true);
    });

    test("should return false if license is inactive", async () => {
      mockGetEnterpriseLicense.mockResolvedValueOnce({ active: false, features: {} });
      const result = await getMultiLanguagePermission(mockOrganization.billing.plan);
      expect(result).toBe(false);
    });
  });

  describe("getIsMultiOrgEnabled", () => {
    test("should return true if feature flag isMultiOrgEnabled is true", async () => {
      mockGetLicenseFeatures.mockResolvedValueOnce({ isMultiOrgEnabled: true } as TEnterpriseLicenseFeatures);
      const result = await getIsMultiOrgEnabled();
      expect(result).toBe(true);
    });

    test("should return false if feature flag isMultiOrgEnabled is false", async () => {
      mockGetLicenseFeatures.mockResolvedValueOnce({
        isMultiOrgEnabled: false,
      } as TEnterpriseLicenseFeatures);
      const result = await getIsMultiOrgEnabled();
      expect(result).toBe(false);
    });

    test("should return false if licenseFeatures is null", async () => {
      mockGetLicenseFeatures.mockResolvedValueOnce(null);
      const result = await getIsMultiOrgEnabled();
      expect(result).toBe(false);
    });
  });

  describe("getIsContactsEnabled", () => {
    test("should return true if feature flag contacts is true", async () => {
      mockGetLicenseFeatures.mockResolvedValueOnce({ contacts: true } as TEnterpriseLicenseFeatures);
      const result = await getIsContactsEnabled();
      expect(result).toBe(true);
    });

    test("should return false if feature flag contacts is false", async () => {
      mockGetLicenseFeatures.mockResolvedValueOnce({ contacts: false } as TEnterpriseLicenseFeatures);
      const result = await getIsContactsEnabled();
      expect(result).toBe(false);
    });
  });

  describe("getIsTwoFactorAuthEnabled", () => {
    test("should return true if feature flag twoFactorAuth is true", async () => {
      mockGetLicenseFeatures.mockResolvedValueOnce({ twoFactorAuth: true } as TEnterpriseLicenseFeatures);
      const result = await getIsTwoFactorAuthEnabled();
      expect(result).toBe(true);
    });

    test("should return false if feature flag twoFactorAuth is false", async () => {
      mockGetLicenseFeatures.mockResolvedValueOnce({ twoFactorAuth: false } as TEnterpriseLicenseFeatures);
      const result = await getIsTwoFactorAuthEnabled();
      expect(result).toBe(false);
    });
  });

  describe("getIsSsoEnabled", () => {
    test("should return true if feature flag sso is true", async () => {
      mockGetLicenseFeatures.mockResolvedValueOnce({ sso: true } as TEnterpriseLicenseFeatures);
      const result = await getIsSsoEnabled();
      expect(result).toBe(true);
    });

    test("should return false if feature flag sso is false", async () => {
      mockGetLicenseFeatures.mockResolvedValueOnce({ sso: false } as TEnterpriseLicenseFeatures);
      const result = await getIsSsoEnabled();
      expect(result).toBe(false);
    });
  });

  describe("getIsSamlSsoEnabled", () => {
    test("should return false if IS_FORMBRICKS_CLOUD is true", async () => {
      mockConstants.IS_FORMBRICKS_CLOUD = true;
      const result = await getIsSamlSsoEnabled();
      expect(result).toBe(false);
    });

    test("should return true if sso and saml flags are true (self-hosted)", async () => {
      mockConstants.IS_FORMBRICKS_CLOUD = false;
      mockGetLicenseFeatures.mockResolvedValueOnce({ sso: true, saml: true } as TEnterpriseLicenseFeatures);
      const result = await getIsSamlSsoEnabled();
      expect(result).toBe(true);
    });

    test("should return false if sso is true but saml is false (self-hosted)", async () => {
      mockConstants.IS_FORMBRICKS_CLOUD = false;
      mockGetLicenseFeatures.mockResolvedValueOnce({ sso: true, saml: false } as TEnterpriseLicenseFeatures);
      const result = await getIsSamlSsoEnabled();
      expect(result).toBe(false);
    });

    test("should return false if licenseFeatures is null (self-hosted)", async () => {
      mockConstants.IS_FORMBRICKS_CLOUD = false;
      mockGetLicenseFeatures.mockResolvedValueOnce(null);
      const result = await getIsSamlSsoEnabled();
      expect(result).toBe(false);
    });
  });

  describe("getIsSpamProtectionEnabled", () => {
    test("should return false if IS_RECAPTCHA_CONFIGURED is false", async () => {
      mockConstants.IS_RECAPTCHA_CONFIGURED = false;
      const result = await getIsSpamProtectionEnabled(mockOrganization.billing.plan);
      expect(result).toBe(false);
      mockConstants.IS_RECAPTCHA_CONFIGURED = true; // reset for other tests
    });

    test("should return true if license active, feature enabled, and plan is SCALE (cloud)", async () => {
      mockConstants.IS_FORMBRICKS_CLOUD = true;
      mockGetEnterpriseLicense.mockResolvedValueOnce({ active: true, features: { spamProtection: true } });
      const result = await getIsSpamProtectionEnabled("scale");
      expect(result).toBe(true);
    });

    test("should return false if license active, feature enabled, but plan is not SCALE or ENTERPRISE (cloud)", async () => {
      mockConstants.IS_FORMBRICKS_CLOUD = true;
      mockGetEnterpriseLicense.mockResolvedValueOnce({ active: true, features: { spamProtection: true } });
      const result = await getIsSpamProtectionEnabled("pro");
      expect(result).toBe(false);
    });

    test("should return true if license active and feature enabled (self-hosted)", async () => {
      mockConstants.IS_FORMBRICKS_CLOUD = false;
      mockGetEnterpriseLicense.mockResolvedValueOnce({ active: true, features: { spamProtection: true } });
      const result = await getIsSpamProtectionEnabled(mockOrganization.billing.plan);
      expect(result).toBe(true);
    });

    test("should return false if license is inactive", async () => {
      mockGetEnterpriseLicense.mockResolvedValueOnce({ active: false, features: {} });
      const result = await getIsSpamProtectionEnabled(mockOrganization.billing.plan);
      expect(result).toBe(false);
    });
  });

  describe("getOrganizationProjectsLimit", () => {
    test("should return limits.projects if license active (cloud)", async () => {
      mockConstants.IS_FORMBRICKS_CLOUD = true;
      mockGetEnterpriseLicense.mockResolvedValueOnce({ active: true, features: {} });
      const limits = { projects: 10 };
      const result = await getOrganizationProjectsLimit(limits);
      expect(result).toBe(10);
    });

    test("should return Infinity if limits.projects is null and license active (cloud)", async () => {
      mockConstants.IS_FORMBRICKS_CLOUD = true;
      mockGetEnterpriseLicense.mockResolvedValueOnce({ active: true, features: {} });
      const limits = { projects: null };
      const result = await getOrganizationProjectsLimit(limits);
      expect(result).toBe(Infinity);
    });

    test("should return 3 if license inactive (cloud)", async () => {
      mockConstants.IS_FORMBRICKS_CLOUD = true;
      mockGetEnterpriseLicense.mockResolvedValueOnce({ active: false, features: {} });
      const result = await getOrganizationProjectsLimit(mockOrganization.billing.limits);
      expect(result).toBe(3);
    });

    test("should return license.features.projects if defined and license active (self-hosted)", async () => {
      mockConstants.IS_FORMBRICKS_CLOUD = false;
      mockGetEnterpriseLicense.mockResolvedValueOnce({ active: true, features: { projects: 5 } });
      const result = await getOrganizationProjectsLimit(mockOrganization.billing.limits);
      expect(result).toBe(5);
    });

    test("should return 3 if license.features.projects is undefined and license active (self-hosted)", async () => {
      mockConstants.IS_FORMBRICKS_CLOUD = false;
      mockGetEnterpriseLicense.mockResolvedValueOnce({ active: true, features: { projects: undefined } });
      const result = await getOrganizationProjectsLimit(mockOrganization.billing.limits);
      expect(result).toBe(3);
    });

    test("should return 3 if license inactive (self-hosted)", async () => {
      mockConstants.IS_FORMBRICKS_CLOUD = false;
      mockGetEnterpriseLicense.mockResolvedValueOnce({ active: false, features: {} });
      const result = await getOrganizationProjectsLimit(mockOrganization.billing.limits);
      expect(result).toBe(3);
    });
  });
});
