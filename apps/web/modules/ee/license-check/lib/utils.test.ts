import { beforeEach, describe, expect, test, vi } from "vitest";
import * as constants from "@/lib/constants";
import { CLOUD_STRIPE_FEATURE_LOOKUP_KEYS } from "@/modules/billing/lib/stripe-catalog";
import type { TEnterpriseLicenseFeatures } from "@/modules/ee/license-check/types/enterprise-license";
import { hasOrganizationEntitlementWithLicenseGuard } from "@/modules/entitlements/lib/checks";
import { getOrganizationEntitlementsContext } from "@/modules/entitlements/lib/provider";
import type { TOrganizationEntitlementsContext } from "@/modules/entitlements/lib/types";
import { getEnterpriseLicense, getLicenseFeatures } from "./license";
import {
  getAccessControlPermission,
  getBiggerUploadFileSizePermission,
  getIsAuditLogsEnabled,
  getIsContactsEnabled,
  getIsMultiOrgEnabled,
  getIsQuotasEnabled,
  getIsSamlSsoEnabled,
  getIsSpamProtectionEnabled,
  getIsSsoEnabled,
  getIsTwoFactorAuthEnabled,
  getMultiLanguagePermission,
  getOrganizationProjectsLimit,
  getRemoveBrandingPermission,
  getWhiteLabelPermission,
} from "./utils";

vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/constants")>();
  return {
    ...actual,
    IS_FORMBRICKS_CLOUD: false,
    IS_RECAPTCHA_CONFIGURED: true,
    AUDIT_LOG_ENABLED: true,
  };
});

vi.mock("@/modules/entitlements/lib/checks", () => ({
  hasOrganizationEntitlementWithLicenseGuard: vi.fn(),
}));

vi.mock("@/modules/entitlements/lib/provider", () => ({
  getOrganizationEntitlementsContext: vi.fn(),
}));

vi.mock("./license", () => ({
  getEnterpriseLicense: vi.fn(),
  getLicenseFeatures: vi.fn(),
}));

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
  multiLanguageSurveys: false,
  accessControl: false,
  quotas: false,
};

const defaultLicense = {
  active: true,
  features: defaultFeatures,
  lastChecked: new Date(),
  isPendingDowngrade: false,
  fallbackLevel: "live" as const,
};

const defaultEntitlementsContext: TOrganizationEntitlementsContext = {
  organizationId: "org_1",
  source: "cloud_stripe",
  features: [],
  limits: {
    projects: 3,
    monthlyResponses: null,
    monthlyMiu: null,
  },
  licenseStatus: "active",
  licenseFeatures: defaultFeatures,
  stripeCustomerId: "cus_123",
  periodStart: new Date(),
};

describe("License Utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(constants).IS_FORMBRICKS_CLOUD = false;
    vi.mocked(constants).IS_RECAPTCHA_CONFIGURED = true;
    vi.mocked(constants).AUDIT_LOG_ENABLED = true;

    vi.mocked(getEnterpriseLicense).mockResolvedValue(defaultLicense);
    vi.mocked(getLicenseFeatures).mockResolvedValue(defaultFeatures);
    vi.mocked(hasOrganizationEntitlementWithLicenseGuard).mockResolvedValue(false);
    vi.mocked(getOrganizationEntitlementsContext).mockResolvedValue(defaultEntitlementsContext);
  });

  describe("branding permissions", () => {
    test("returns self-hosted remove-branding permission from active license feature", async () => {
      vi.mocked(getEnterpriseLicense).mockResolvedValue({
        ...defaultLicense,
        features: { ...defaultFeatures, removeBranding: true },
      });

      const result = await getRemoveBrandingPermission({ organizationId: "org_1" });

      expect(result).toBe(true);
    });

    test("returns self-hosted whitelabel permission from active license feature", async () => {
      vi.mocked(getEnterpriseLicense).mockResolvedValue({
        ...defaultLicense,
        features: { ...defaultFeatures, whitelabel: true },
      });

      const result = await getWhiteLabelPermission({ organizationId: "org_1" });

      expect(result).toBe(true);
    });

    test("uses cloud hide-branding entitlement for remove-branding", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(hasOrganizationEntitlementWithLicenseGuard).mockResolvedValueOnce(true);

      const result = await getRemoveBrandingPermission({ organizationId: "org_1" });

      expect(result).toBe(true);
      expect(hasOrganizationEntitlementWithLicenseGuard).toHaveBeenCalledWith(
        "org_1",
        CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.HIDE_BRANDING
      );
    });

    test("uses cloud hide-branding entitlement for whitelabel", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(hasOrganizationEntitlementWithLicenseGuard).mockResolvedValueOnce(true);

      const result = await getWhiteLabelPermission({ organizationId: "org_1" });

      expect(result).toBe(true);
      expect(hasOrganizationEntitlementWithLicenseGuard).toHaveBeenCalledWith(
        "org_1",
        CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.HIDE_BRANDING
      );
    });
  });

  describe("custom plan guarded permissions", () => {
    test("uses cloud RBAC entitlement for access control", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(hasOrganizationEntitlementWithLicenseGuard).mockResolvedValueOnce(true);

      const result = await getAccessControlPermission({ organizationId: "org_1" });

      expect(result).toBe(true);
      expect(hasOrganizationEntitlementWithLicenseGuard).toHaveBeenCalledWith(
        "org_1",
        CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.RBAC
      );
    });

    test("uses cloud multi-language entitlement", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(hasOrganizationEntitlementWithLicenseGuard).mockResolvedValueOnce(true);

      const result = await getMultiLanguagePermission({ organizationId: "org_1" });

      expect(result).toBe(true);
      expect(hasOrganizationEntitlementWithLicenseGuard).toHaveBeenCalledWith(
        "org_1",
        CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.MULTI_LANGUAGE_SURVEYS
      );
    });

    test("uses cloud quota entitlement", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(hasOrganizationEntitlementWithLicenseGuard).mockResolvedValueOnce(true);

      const result = await getIsQuotasEnabled({ organizationId: "org_1" });

      expect(result).toBe(true);
      expect(hasOrganizationEntitlementWithLicenseGuard).toHaveBeenCalledWith(
        "org_1",
        CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.QUOTA_MANAGEMENT
      );
    });

    test("returns self-hosted custom feature from license", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = false;
      vi.mocked(getEnterpriseLicense).mockResolvedValue({
        ...defaultLicense,
        features: {
          ...defaultFeatures,
          accessControl: true,
          multiLanguageSurveys: true,
          quotas: true,
        },
      });

      const [access, multiLanguage, quotas] = await Promise.all([
        getAccessControlPermission({ organizationId: "org_1" }),
        getMultiLanguagePermission({ organizationId: "org_1" }),
        getIsQuotasEnabled({ organizationId: "org_1" }),
      ]);

      expect(access).toBe(true);
      expect(multiLanguage).toBe(true);
      expect(quotas).toBe(true);
    });
  });

  describe("getBiggerUploadFileSizePermission", () => {
    test("returns true for self-hosted active license status", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = false;
      vi.mocked(getOrganizationEntitlementsContext).mockResolvedValue({
        ...defaultEntitlementsContext,
        source: "self_hosted_license",
        licenseStatus: "active",
      });

      const result = await getBiggerUploadFileSizePermission("org_1");

      expect(result).toBe(true);
    });

    test("returns false for self-hosted non-active license status", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = false;
      vi.mocked(getOrganizationEntitlementsContext).mockResolvedValue({
        ...defaultEntitlementsContext,
        source: "self_hosted_license",
        licenseStatus: "expired",
      });

      const result = await getBiggerUploadFileSizePermission("org_1");

      expect(result).toBe(false);
    });

    test("returns true on cloud when paid capacity and active/no-license status", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(getOrganizationEntitlementsContext).mockResolvedValue({
        ...defaultEntitlementsContext,
        licenseStatus: "active",
        limits: { ...defaultEntitlementsContext.limits, projects: 10 },
      });

      const result = await getBiggerUploadFileSizePermission("org_1");

      expect(result).toBe(true);
    });

    test("returns false on cloud for hobby-level capacity", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(getOrganizationEntitlementsContext).mockResolvedValue({
        ...defaultEntitlementsContext,
        licenseStatus: "active",
        limits: { ...defaultEntitlementsContext.limits, projects: 1 },
      });

      const result = await getBiggerUploadFileSizePermission("org_1");

      expect(result).toBe(false);
    });

    test("returns false on cloud when license status is not usable", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(getOrganizationEntitlementsContext).mockResolvedValue({
        ...defaultEntitlementsContext,
        licenseStatus: "expired",
        limits: { ...defaultEntitlementsContext.limits, projects: 10 },
      });

      const result = await getBiggerUploadFileSizePermission("org_1");

      expect(result).toBe(false);
    });
  });

  describe("flag-only permissions", () => {
    test("returns multi-org, contacts, 2fa and sso from license features", async () => {
      vi.mocked(getLicenseFeatures).mockResolvedValue({
        ...defaultFeatures,
        isMultiOrgEnabled: true,
        contacts: true,
        twoFactorAuth: true,
        sso: true,
      });

      const [multiOrg, contacts, twoFactor, sso] = await Promise.all([
        getIsMultiOrgEnabled(),
        getIsContactsEnabled(),
        getIsTwoFactorAuthEnabled(),
        getIsSsoEnabled(),
      ]);

      expect(multiOrg).toBe(true);
      expect(contacts).toBe(true);
      expect(twoFactor).toBe(true);
      expect(sso).toBe(true);
    });

    test("returns false when features are unavailable", async () => {
      vi.mocked(getLicenseFeatures).mockResolvedValue(null);

      const [multiOrg, contacts, twoFactor, sso] = await Promise.all([
        getIsMultiOrgEnabled(),
        getIsContactsEnabled(),
        getIsTwoFactorAuthEnabled(),
        getIsSsoEnabled(),
      ]);

      expect(multiOrg).toBe(false);
      expect(contacts).toBe(false);
      expect(twoFactor).toBe(false);
      expect(sso).toBe(false);
    });
  });

  describe("getIsSamlSsoEnabled", () => {
    test("returns false on cloud", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;

      const result = await getIsSamlSsoEnabled();

      expect(result).toBe(false);
    });

    test("returns true when both sso and saml features are enabled in self-hosted", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = false;
      vi.mocked(getLicenseFeatures).mockResolvedValue({
        ...defaultFeatures,
        sso: true,
        saml: true,
      });

      const result = await getIsSamlSsoEnabled();

      expect(result).toBe(true);
    });
  });

  describe("getIsSpamProtectionEnabled", () => {
    test("returns false when recaptcha is not configured", async () => {
      vi.mocked(constants).IS_RECAPTCHA_CONFIGURED = false;

      const result = await getIsSpamProtectionEnabled({ organizationId: "org_1" });

      expect(result).toBe(false);
      expect(hasOrganizationEntitlementWithLicenseGuard).not.toHaveBeenCalled();
    });

    test("uses cloud spam-protection entitlement when configured", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(hasOrganizationEntitlementWithLicenseGuard).mockResolvedValueOnce(true);

      const result = await getIsSpamProtectionEnabled({ organizationId: "org_1" });

      expect(result).toBe(true);
      expect(hasOrganizationEntitlementWithLicenseGuard).toHaveBeenCalledWith(
        "org_1",
        CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.SPAM_PROTECTION
      );
    });

    test("returns self-hosted spam-protection feature from active license", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = false;
      vi.mocked(getEnterpriseLicense).mockResolvedValue({
        ...defaultLicense,
        features: { ...defaultFeatures, spamProtection: true },
      });

      const result = await getIsSpamProtectionEnabled({ organizationId: "org_1" });

      expect(result).toBe(true);
    });
  });

  describe("getOrganizationProjectsLimit", () => {
    test("returns cloud projects limit when cloud license status allows usage", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(getOrganizationEntitlementsContext).mockResolvedValue({
        ...defaultEntitlementsContext,
        licenseStatus: "active",
        limits: { ...defaultEntitlementsContext.limits, projects: 10 },
      });

      const result = await getOrganizationProjectsLimit("org_1");

      expect(result).toBe(10);
    });

    test("returns Infinity when cloud projects limit is unbounded", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(getOrganizationEntitlementsContext).mockResolvedValue({
        ...defaultEntitlementsContext,
        licenseStatus: "no-license",
        limits: { ...defaultEntitlementsContext.limits, projects: null },
      });

      const result = await getOrganizationProjectsLimit("org_1");

      expect(result).toBe(Infinity);
    });

    test("returns 3 when cloud license status does not allow usage", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(getOrganizationEntitlementsContext).mockResolvedValue({
        ...defaultEntitlementsContext,
        licenseStatus: "expired",
        limits: { ...defaultEntitlementsContext.limits, projects: 10 },
      });

      const result = await getOrganizationProjectsLimit("org_1");

      expect(result).toBe(3);
    });

    test("returns self-hosted project limit from active license feature", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = false;
      vi.mocked(getOrganizationEntitlementsContext).mockResolvedValue({
        ...defaultEntitlementsContext,
        source: "self_hosted_license",
        licenseStatus: "active",
        licenseFeatures: { ...defaultFeatures, projects: 5 },
      });

      const result = await getOrganizationProjectsLimit("org_1");

      expect(result).toBe(5);
    });

    test("returns 3 for self-hosted without active project entitlement", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = false;
      vi.mocked(getOrganizationEntitlementsContext).mockResolvedValue({
        ...defaultEntitlementsContext,
        source: "self_hosted_license",
        licenseStatus: "active",
        licenseFeatures: { ...defaultFeatures, projects: null },
      });

      const result = await getOrganizationProjectsLimit("org_1");

      expect(result).toBe(3);
    });
  });

  describe("getIsAuditLogsEnabled", () => {
    test("returns false when audit logs are globally disabled", async () => {
      vi.mocked(constants).AUDIT_LOG_ENABLED = false;
      vi.mocked(getLicenseFeatures).mockResolvedValue({ ...defaultFeatures, auditLogs: true });

      const result = await getIsAuditLogsEnabled();

      expect(result).toBe(false);
    });

    test("returns true when audit logs are globally enabled and licensed", async () => {
      vi.mocked(constants).AUDIT_LOG_ENABLED = true;
      vi.mocked(getLicenseFeatures).mockResolvedValue({ ...defaultFeatures, auditLogs: true });

      const result = await getIsAuditLogsEnabled();

      expect(result).toBe(true);
    });

    test("returns false when auditLogs feature is not enabled", async () => {
      vi.mocked(constants).AUDIT_LOG_ENABLED = true;
      vi.mocked(getLicenseFeatures).mockResolvedValue({ ...defaultFeatures, auditLogs: false });

      const result = await getIsAuditLogsEnabled();

      expect(result).toBe(false);
    });
  });
});
