import * as constants from "@/lib/constants";
import { TEnterpriseLicenseFeatures } from "@/modules/ee/license-check/types/enterprise-license";
import { Organization } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import * as licenseModule from "./license";
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

vi.mock("@/lib/constants");
vi.mock("./license");

const mockOrganization = {
  billing: {
    plan: constants.PROJECT_FEATURE_KEYS.FREE,
    limits: {
      projects: 3,
      monthly: {
        responses: null,
        miu: null,
      },
    },
  },
} as Organization;

const defaultFeatures: TEnterpriseLicenseFeatures = {
  whitelabel: false,
  projects: null,
  isMultiOrgEnabled: false,
  contacts: false,
  removeBranding: false,
  twoFactorAuth: false,
  sso: false,
  saml: false,
  spamProtection: false,
  ai: false,
  auditLogs: false,
};

const defaultLicense = {
  active: true,
  features: defaultFeatures,
  lastChecked: new Date(),
  isPendingDowngrade: false,
  fallbackLevel: "live" as const,
};

describe("License Utils", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Set default values for constants
    vi.mocked(constants).IS_FORMBRICKS_CLOUD = false;
    vi.mocked(constants).IS_RECAPTCHA_CONFIGURED = true;
    vi.mocked(constants).PROJECT_FEATURE_KEYS = constants.PROJECT_FEATURE_KEYS;
    // Set default mocks for license
    vi.mocked(licenseModule.getEnterpriseLicense).mockResolvedValue(defaultLicense);
    vi.mocked(licenseModule.getLicenseFeatures).mockResolvedValue(defaultFeatures);
  });

  describe("getRemoveBrandingPermission", () => {
    test("should return true if license active and feature enabled (self-hosted)", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = false;
      vi.mocked(licenseModule.getEnterpriseLicense).mockResolvedValue({
        ...defaultLicense,
        features: { ...defaultFeatures, removeBranding: true },
      });
      const result = await getRemoveBrandingPermission(mockOrganization.billing.plan);
      expect(result).toBe(true);
    });

    test("should return false if license active but feature disabled (self-hosted)", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = false;
      vi.mocked(licenseModule.getEnterpriseLicense).mockResolvedValue({
        ...defaultLicense,
        features: { ...defaultFeatures, removeBranding: false },
      });
      const result = await getRemoveBrandingPermission(mockOrganization.billing.plan);
      expect(result).toBe(false);
    });

    test("should return true if license active and plan is not FREE (cloud)", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(licenseModule.getEnterpriseLicense).mockResolvedValue(defaultLicense);
      const result = await getRemoveBrandingPermission(constants.PROJECT_FEATURE_KEYS.SCALE);
      expect(result).toBe(true);
    });

    test("should return false if license active and plan is FREE (cloud)", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(licenseModule.getEnterpriseLicense).mockResolvedValue(defaultLicense);
      const result = await getRemoveBrandingPermission(constants.PROJECT_FEATURE_KEYS.FREE);
      expect(result).toBe(false);
    });

    test("should return false if license is inactive", async () => {
      vi.mocked(licenseModule.getEnterpriseLicense).mockResolvedValue({
        ...defaultLicense,
        active: false,
      });
      const result = await getRemoveBrandingPermission(mockOrganization.billing.plan);
      expect(result).toBe(false);
    });
  });

  describe("getWhiteLabelPermission", () => {
    test("should return true if license active and feature enabled (self-hosted)", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = false;
      vi.mocked(licenseModule.getEnterpriseLicense).mockResolvedValue({
        ...defaultLicense,
        features: { ...defaultFeatures, whitelabel: true },
      });
      const result = await getWhiteLabelPermission(mockOrganization.billing.plan);
      expect(result).toBe(true);
    });

    test("should return true if license active and plan is not FREE (cloud)", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(licenseModule.getEnterpriseLicense).mockResolvedValue(defaultLicense);
      const result = await getWhiteLabelPermission(constants.PROJECT_FEATURE_KEYS.SCALE);
      expect(result).toBe(true);
    });

    test("should return false if license is inactive", async () => {
      vi.mocked(licenseModule.getEnterpriseLicense).mockResolvedValue({
        ...defaultLicense,
        active: false,
      });
      const result = await getWhiteLabelPermission(mockOrganization.billing.plan);
      expect(result).toBe(false);
    });
  });

  describe("getRoleManagementPermission", () => {
    test("should return true if license active (self-hosted)", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = false;
      vi.mocked(licenseModule.getEnterpriseLicense).mockResolvedValue(defaultLicense);
      const result = await getRoleManagementPermission(mockOrganization.billing.plan);
      expect(result).toBe(true);
    });

    test("should return true if license active and plan is SCALE (cloud)", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(licenseModule.getEnterpriseLicense).mockResolvedValue(defaultLicense);
      const result = await getRoleManagementPermission(constants.PROJECT_FEATURE_KEYS.SCALE);
      expect(result).toBe(true);
    });

    test("should return true if license active and plan is ENTERPRISE (cloud)", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(licenseModule.getEnterpriseLicense).mockResolvedValue(defaultLicense);
      const result = await getRoleManagementPermission(constants.PROJECT_FEATURE_KEYS.ENTERPRISE);
      expect(result).toBe(true);
    });

    test("should return false if license active and plan is not SCALE or ENTERPRISE (cloud)", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(licenseModule.getEnterpriseLicense).mockResolvedValue(defaultLicense);
      const result = await getRoleManagementPermission(constants.PROJECT_FEATURE_KEYS.STARTUP);
      expect(result).toBe(false);
    });

    test("should return false if license is inactive", async () => {
      vi.mocked(licenseModule.getEnterpriseLicense).mockResolvedValue({
        ...defaultLicense,
        active: false,
      });
      const result = await getRoleManagementPermission(mockOrganization.billing.plan);
      expect(result).toBe(false);
    });
  });

  describe("getBiggerUploadFileSizePermission", () => {
    test("should return true if license active (self-hosted)", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = false;
      vi.mocked(licenseModule.getEnterpriseLicense).mockResolvedValue(defaultLicense);
      const result = await getBiggerUploadFileSizePermission(mockOrganization.billing.plan);
      expect(result).toBe(true);
    });

    test("should return true if license active and plan is not FREE (cloud)", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(licenseModule.getEnterpriseLicense).mockResolvedValue(defaultLicense);
      const result = await getBiggerUploadFileSizePermission(constants.PROJECT_FEATURE_KEYS.SCALE);
      expect(result).toBe(true);
    });

    test("should return false if license active and plan is FREE (cloud)", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(licenseModule.getEnterpriseLicense).mockResolvedValue(defaultLicense);
      const result = await getBiggerUploadFileSizePermission(constants.PROJECT_FEATURE_KEYS.FREE);
      expect(result).toBe(false);
    });

    test("should return false if license is inactive", async () => {
      vi.mocked(licenseModule.getEnterpriseLicense).mockResolvedValue({
        ...defaultLicense,
        active: false,
      });
      const result = await getBiggerUploadFileSizePermission(mockOrganization.billing.plan);
      expect(result).toBe(false);
    });
  });

  describe("getMultiLanguagePermission", () => {
    test("should return true if license active (self-hosted)", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = false;
      vi.mocked(licenseModule.getEnterpriseLicense).mockResolvedValue(defaultLicense);
      const result = await getMultiLanguagePermission(mockOrganization.billing.plan);
      expect(result).toBe(true);
    });

    test("should return true if license active and plan is SCALE (cloud)", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(licenseModule.getEnterpriseLicense).mockResolvedValue(defaultLicense);
      const result = await getMultiLanguagePermission(constants.PROJECT_FEATURE_KEYS.SCALE);
      expect(result).toBe(true);
    });

    test("should return false if license is inactive", async () => {
      vi.mocked(licenseModule.getEnterpriseLicense).mockResolvedValue({
        ...defaultLicense,
        active: false,
      });
      const result = await getMultiLanguagePermission(mockOrganization.billing.plan);
      expect(result).toBe(false);
    });
  });

  describe("getIsMultiOrgEnabled", () => {
    test("should return true if feature flag isMultiOrgEnabled is true", async () => {
      vi.mocked(licenseModule.getLicenseFeatures).mockResolvedValue({
        ...defaultFeatures,
        isMultiOrgEnabled: true,
      });
      const result = await getIsMultiOrgEnabled();
      expect(result).toBe(true);
    });

    test("should return false if feature flag isMultiOrgEnabled is false", async () => {
      vi.mocked(licenseModule.getLicenseFeatures).mockResolvedValue({
        ...defaultFeatures,
        isMultiOrgEnabled: false,
      });
      const result = await getIsMultiOrgEnabled();
      expect(result).toBe(false);
    });

    test("should return false if licenseFeatures is null", async () => {
      vi.mocked(licenseModule.getLicenseFeatures).mockResolvedValue(null);
      const result = await getIsMultiOrgEnabled();
      expect(result).toBe(false);
    });
  });

  describe("getIsContactsEnabled", () => {
    test("should return true if feature flag contacts is true", async () => {
      vi.mocked(licenseModule.getLicenseFeatures).mockResolvedValue({
        ...defaultFeatures,
        contacts: true,
      });
      const result = await getIsContactsEnabled();
      expect(result).toBe(true);
    });

    test("should return false if feature flag contacts is false", async () => {
      vi.mocked(licenseModule.getLicenseFeatures).mockResolvedValue({
        ...defaultFeatures,
        contacts: false,
      });
      const result = await getIsContactsEnabled();
      expect(result).toBe(false);
    });
  });

  describe("getIsTwoFactorAuthEnabled", () => {
    test("should return true if feature flag twoFactorAuth is true", async () => {
      vi.mocked(licenseModule.getLicenseFeatures).mockResolvedValue({
        ...defaultFeatures,
        twoFactorAuth: true,
      });
      const result = await getIsTwoFactorAuthEnabled();
      expect(result).toBe(true);
    });

    test("should return false if feature flag twoFactorAuth is false", async () => {
      vi.mocked(licenseModule.getLicenseFeatures).mockResolvedValue({
        ...defaultFeatures,
        twoFactorAuth: false,
      });
      const result = await getIsTwoFactorAuthEnabled();
      expect(result).toBe(false);
    });
  });

  describe("getIsSsoEnabled", () => {
    test("should return true if feature flag sso is true", async () => {
      vi.mocked(licenseModule.getLicenseFeatures).mockResolvedValue({
        ...defaultFeatures,
        sso: true,
      });
      const result = await getIsSsoEnabled();
      expect(result).toBe(true);
    });

    test("should return false if feature flag sso is false", async () => {
      vi.mocked(licenseModule.getLicenseFeatures).mockResolvedValue({
        ...defaultFeatures,
        sso: false,
      });
      const result = await getIsSsoEnabled();
      expect(result).toBe(false);
    });
  });

  describe("getIsSamlSsoEnabled", () => {
    test("should return false if IS_FORMBRICKS_CLOUD is true", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      const result = await getIsSamlSsoEnabled();
      expect(result).toBe(false);
    });

    test("should return true if sso and saml flags are true (self-hosted)", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = false;
      vi.mocked(licenseModule.getLicenseFeatures).mockResolvedValue({
        ...defaultFeatures,
        sso: true,
        saml: true,
      });
      const result = await getIsSamlSsoEnabled();
      expect(result).toBe(true);
    });

    test("should return false if sso is true but saml is false (self-hosted)", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = false;
      vi.mocked(licenseModule.getLicenseFeatures).mockResolvedValue({
        ...defaultFeatures,
        sso: true,
        saml: false,
      });
      const result = await getIsSamlSsoEnabled();
      expect(result).toBe(false);
    });

    test("should return false if licenseFeatures is null (self-hosted)", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = false;
      vi.mocked(licenseModule.getLicenseFeatures).mockResolvedValue(null);
      const result = await getIsSamlSsoEnabled();
      expect(result).toBe(false);
    });
  });

  describe("getIsSpamProtectionEnabled", () => {
    test("should return false if IS_RECAPTCHA_CONFIGURED is false", async () => {
      vi.mocked(constants).IS_RECAPTCHA_CONFIGURED = false;
      const result = await getIsSpamProtectionEnabled(mockOrganization.billing.plan);
      expect(result).toBe(false);
      vi.mocked(constants).IS_RECAPTCHA_CONFIGURED = true; // reset for other tests
    });

    test("should return true if license active, feature enabled, and plan is SCALE (cloud)", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(licenseModule.getEnterpriseLicense).mockResolvedValue({
        ...defaultLicense,
        features: { ...defaultFeatures, spamProtection: true },
      });
      const result = await getIsSpamProtectionEnabled(constants.PROJECT_FEATURE_KEYS.SCALE);
      expect(result).toBe(true);
    });

    test("should return false if license active, feature enabled, but plan is not SCALE or ENTERPRISE (cloud)", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(licenseModule.getEnterpriseLicense).mockResolvedValue({
        ...defaultLicense,
        features: { ...defaultFeatures, spamProtection: true },
      });
      const result = await getIsSpamProtectionEnabled(constants.PROJECT_FEATURE_KEYS.STARTUP);
      expect(result).toBe(false);
    });

    test("should return true if license active and feature enabled (self-hosted)", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = false;
      vi.mocked(licenseModule.getEnterpriseLicense).mockResolvedValue({
        ...defaultLicense,
        features: { ...defaultFeatures, spamProtection: true },
      });
      const result = await getIsSpamProtectionEnabled(mockOrganization.billing.plan);
      expect(result).toBe(true);
    });

    test("should return false if license is inactive", async () => {
      vi.mocked(licenseModule.getEnterpriseLicense).mockResolvedValue({
        ...defaultLicense,
        active: false,
      });
      const result = await getIsSpamProtectionEnabled(mockOrganization.billing.plan);
      expect(result).toBe(false);
    });
  });

  describe("getOrganizationProjectsLimit", () => {
    test("should return limits.projects if license active (cloud)", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(licenseModule.getEnterpriseLicense).mockResolvedValue(defaultLicense);
      const limits = {
        projects: 10,
        monthly: {
          responses: null,
          miu: null,
        },
      };
      const result = await getOrganizationProjectsLimit(limits);
      expect(result).toBe(10);
    });

    test("should return Infinity if limits.projects is null and license active (cloud)", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(licenseModule.getEnterpriseLicense).mockResolvedValue(defaultLicense);
      const limits = {
        projects: null,
        monthly: {
          responses: null,
          miu: null,
        },
      };
      const result = await getOrganizationProjectsLimit(limits);
      expect(result).toBe(Infinity);
    });

    test("should return 3 if license inactive (cloud)", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(licenseModule.getEnterpriseLicense).mockResolvedValue({
        ...defaultLicense,
        active: false,
      });
      const result = await getOrganizationProjectsLimit(mockOrganization.billing.limits);
      expect(result).toBe(3);
    });

    test("should return license.features.projects if defined and license active (self-hosted)", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = false;
      vi.mocked(licenseModule.getEnterpriseLicense).mockResolvedValue({
        ...defaultLicense,
        features: { ...defaultFeatures, projects: 5 },
      });
      const result = await getOrganizationProjectsLimit(mockOrganization.billing.limits);
      expect(result).toBe(5);
    });

    test("should return 3 if license.features.projects is undefined and license active (self-hosted)", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = false;
      vi.mocked(licenseModule.getEnterpriseLicense).mockResolvedValue({
        ...defaultLicense,
        features: { ...defaultFeatures, projects: null },
      });
      const result = await getOrganizationProjectsLimit(mockOrganization.billing.limits);
      expect(result).toBe(3);
    });

    test("should return 3 if license inactive (self-hosted)", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = false;
      vi.mocked(licenseModule.getEnterpriseLicense).mockResolvedValue({
        ...defaultLicense,
        active: false,
      });
      const result = await getOrganizationProjectsLimit(mockOrganization.billing.limits);
      expect(result).toBe(3);
    });
  });

  describe("getIsAuditLogsEnabled", () => {
    const auditLogsFeature = { ...defaultFeatures, auditLogs: true };
    const noAuditLogsFeature = { ...defaultFeatures, auditLogs: false };

    beforeEach(() => {
      vi.resetModules();
    });

    test("returns true if all conditions met (self-hosted)", async () => {
      vi.doMock("@/lib/constants", () => ({
        AUDIT_LOG_ENABLED: true,
      }));
      const { getIsAuditLogsEnabled } = await import("./utils");
      vi.mocked(licenseModule.getLicenseFeatures).mockResolvedValue(auditLogsFeature);
      const result = await getIsAuditLogsEnabled();
      expect(result).toBe(true);
    });

    test("returns false if license inactive (self-hosted)", async () => {
      vi.doMock("@/lib/constants", () => ({
        AUDIT_LOG_ENABLED: true,
      }));
      const { getIsAuditLogsEnabled } = await import("./utils");
      vi.mocked(licenseModule.getLicenseFeatures).mockResolvedValue({
        ...auditLogsFeature,
        auditLogs: false,
      });
      const result = await getIsAuditLogsEnabled();
      expect(result).toBe(false);
    });

    test("returns false if auditLogs feature is false (self-hosted)", async () => {
      vi.doMock("@/lib/constants", () => ({
        AUDIT_LOG_ENABLED: true,
      }));
      const { getIsAuditLogsEnabled } = await import("./utils");
      vi.mocked(licenseModule.getLicenseFeatures).mockResolvedValue(noAuditLogsFeature);
      const result = await getIsAuditLogsEnabled();
      expect(result).toBe(false);
    });

    test("returns false if AUDIT_LOG_ENABLED is false (self-hosted)", async () => {
      vi.doMock("@/lib/constants", () => ({
        AUDIT_LOG_ENABLED: false,
      }));
      const { getIsAuditLogsEnabled } = await import("./utils");
      vi.mocked(licenseModule.getLicenseFeatures).mockResolvedValue(auditLogsFeature);
      const result = await getIsAuditLogsEnabled();
      expect(result).toBe(false);
    });

    test("returns true if all conditions met (cloud, ENTERPRISE plan)", async () => {
      vi.doMock("@/lib/constants", () => ({
        AUDIT_LOG_ENABLED: true,
        IS_FORMBRICKS_CLOUD: true,
      }));
      const { getIsAuditLogsEnabled } = await import("./utils");
      vi.mocked(licenseModule.getLicenseFeatures).mockResolvedValue(auditLogsFeature);
      const result = await getIsAuditLogsEnabled();
      expect(result).toBe(true);
    });

    test("returns true if billingPlan is not provided (cloud)", async () => {
      vi.doMock("@/lib/constants", () => ({
        AUDIT_LOG_ENABLED: true,
        IS_FORMBRICKS_CLOUD: true,
      }));
      const { getIsAuditLogsEnabled } = await import("./utils");
      vi.mocked(licenseModule.getLicenseFeatures).mockResolvedValue(auditLogsFeature);
      const result = await getIsAuditLogsEnabled();
      expect(result).toBe(true);
    });
  });
});
