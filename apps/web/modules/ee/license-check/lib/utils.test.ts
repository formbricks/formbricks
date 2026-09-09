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
  getBulkInvitePermission,
  getIsAISmartToolsEnabled,
  getIsAuditLogsEnabled,
  getIsContactsEnabled,
  getIsDashboardsEnabled,
  getIsFeedbackDirectoriesEnabled,
  getIsMultiOrgEnabled,
  getIsQuotasEnabled,
  getIsSamlSsoEnabled,
  getIsSpamProtectionEnabled,
  getIsSsoEnabled,
  getIsTwoFactorAuthEnabled,
  getIsWorkflowsEnabled,
  getOrganizationWorkspacesLimit,
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
  workspaces: null,
  isMultiOrgEnabled: false,
  contacts: false,
  removeBranding: false,
  twoFactorAuth: false,
  sso: false,
  saml: false,
  spamProtection: false,
  aiSmartTools: false,
  auditLogs: false,
  accessControl: false,
  quotas: false,
  feedbackDirectories: false,
  dashboards: false,
  workflows: false,
};

const defaultLicense = {
  active: true,
  features: defaultFeatures,
  lastChecked: new Date(),
  isPendingDowngrade: false,
  fallbackLevel: "live" as const,
  status: "active" as const,
};

const defaultEntitlementsContext: TOrganizationEntitlementsContext = {
  organizationId: "org_1",
  source: "cloud_stripe",
  features: [],
  limits: {
    workspaces: 3,
    monthlyResponses: null,
    monthlyWorkflowRuns: null,
  },
  licenseActive: true,
  licenseStatus: "active",
  licenseFeatures: defaultFeatures,
  stripeCustomerId: "cus_123",
  subscriptionStatus: null,
  usageCycleAnchor: new Date(),
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

      const result = await getRemoveBrandingPermission("org_1");

      expect(result).toBe(true);
    });

    test("returns self-hosted whitelabel permission from active license feature", async () => {
      vi.mocked(getEnterpriseLicense).mockResolvedValue({
        ...defaultLicense,
        features: { ...defaultFeatures, whitelabel: true },
      });

      const result = await getWhiteLabelPermission("org_1");

      expect(result).toBe(true);
    });

    test("uses cloud hide-branding entitlement for remove-branding", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(hasOrganizationEntitlementWithLicenseGuard).mockResolvedValueOnce(true);

      const result = await getRemoveBrandingPermission("org_1");

      expect(result).toBe(true);
      expect(hasOrganizationEntitlementWithLicenseGuard).toHaveBeenCalledWith(
        "org_1",
        CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.HIDE_BRANDING
      );
    });

    test("uses cloud hide-branding entitlement for whitelabel", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(hasOrganizationEntitlementWithLicenseGuard).mockResolvedValueOnce(true);

      const result = await getWhiteLabelPermission("org_1");

      expect(result).toBe(true);
      expect(hasOrganizationEntitlementWithLicenseGuard).toHaveBeenCalledWith(
        "org_1",
        CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.HIDE_BRANDING
      );
    });
  });

  describe("getBulkInvitePermission", () => {
    test("returns true on self-hosted without checking entitlements", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = false;

      const result = await getBulkInvitePermission("org_1");

      expect(result).toBe(true);
      expect(hasOrganizationEntitlementWithLicenseGuard).not.toHaveBeenCalled();
    });

    test("uses the cloud bulk-invite entitlement when entitled", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(hasOrganizationEntitlementWithLicenseGuard).mockResolvedValueOnce(true);

      const result = await getBulkInvitePermission("org_1");

      expect(result).toBe(true);
      expect(hasOrganizationEntitlementWithLicenseGuard).toHaveBeenCalledWith(
        "org_1",
        CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.BULK_INVITE
      );
    });

    test("returns false on cloud when the bulk-invite entitlement is missing", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(hasOrganizationEntitlementWithLicenseGuard).mockResolvedValueOnce(false);

      const result = await getBulkInvitePermission("org_1");

      expect(result).toBe(false);
    });
  });

  describe("custom plan guarded permissions", () => {
    test("uses cloud RBAC entitlement for access control", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(hasOrganizationEntitlementWithLicenseGuard).mockResolvedValueOnce(true);

      const result = await getAccessControlPermission("org_1");

      expect(result).toBe(true);
      expect(hasOrganizationEntitlementWithLicenseGuard).toHaveBeenCalledWith(
        "org_1",
        CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.RBAC
      );
    });

    test("uses cloud quota entitlement", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(hasOrganizationEntitlementWithLicenseGuard).mockResolvedValueOnce(true);

      const result = await getIsQuotasEnabled("org_1");

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
          quotas: true,
        },
      });

      const [access, quotas] = await Promise.all([
        getAccessControlPermission("org_1"),
        getIsQuotasEnabled("org_1"),
      ]);

      expect(access).toBe(true);
      expect(quotas).toBe(true);
    });

    test("uses cloud AI smart tools entitlement", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(hasOrganizationEntitlementWithLicenseGuard).mockResolvedValueOnce(true);

      const result = await getIsAISmartToolsEnabled("org_1");

      expect(result).toBe(true);
      expect(hasOrganizationEntitlementWithLicenseGuard).toHaveBeenCalledWith(
        "org_1",
        CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.AI_SMART_TOOLS
      );
    });

    test("returns self-hosted AI smart tools from license", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = false;
      vi.mocked(getEnterpriseLicense).mockResolvedValue({
        ...defaultLicense,
        features: { ...defaultFeatures, aiSmartTools: true },
      });

      const result = await getIsAISmartToolsEnabled("org_1");
      expect(result).toBe(true);
    });

    test("returns false for self-hosted AI smart tools when not enabled", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = false;
      vi.mocked(getEnterpriseLicense).mockResolvedValue({
        ...defaultLicense,
        features: { ...defaultFeatures, aiSmartTools: false },
      });

      const result = await getIsAISmartToolsEnabled("org_1");
      expect(result).toBe(false);
    });

    test("uses cloud feedback record directories entitlement", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(hasOrganizationEntitlementWithLicenseGuard).mockResolvedValueOnce(true);

      const result = await getIsFeedbackDirectoriesEnabled("org_1");

      expect(result).toBe(true);
      expect(hasOrganizationEntitlementWithLicenseGuard).toHaveBeenCalledWith(
        "org_1",
        CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.FEEDBACK_DIRECTORIES
      );
      expect(getEnterpriseLicense).not.toHaveBeenCalled();
    });

    test("uses cloud dashboards entitlement", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(hasOrganizationEntitlementWithLicenseGuard).mockResolvedValueOnce(true);

      const result = await getIsDashboardsEnabled("org_1");

      expect(result).toBe(true);
      expect(hasOrganizationEntitlementWithLicenseGuard).toHaveBeenCalledWith(
        "org_1",
        CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.DASHBOARDS
      );
      expect(getEnterpriseLicense).not.toHaveBeenCalled();
    });

    test("uses cloud workflows entitlement", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(hasOrganizationEntitlementWithLicenseGuard).mockResolvedValueOnce(true);

      const result = await getIsWorkflowsEnabled("org_1");

      expect(result).toBe(true);
      expect(hasOrganizationEntitlementWithLicenseGuard).toHaveBeenCalledWith(
        "org_1",
        CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.WORKFLOWS
      );
      expect(getEnterpriseLicense).not.toHaveBeenCalled();
    });

    test("returns self-hosted FRD / dashboards / workflows from license", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = false;
      vi.mocked(getEnterpriseLicense).mockResolvedValue({
        ...defaultLicense,
        features: {
          ...defaultFeatures,
          feedbackDirectories: true,
          dashboards: true,
          workflows: true,
        },
      });

      const [frd, dashboards, workflows] = await Promise.all([
        getIsFeedbackDirectoriesEnabled("org_1"),
        getIsDashboardsEnabled("org_1"),
        getIsWorkflowsEnabled("org_1"),
      ]);

      expect(frd).toBe(true);
      expect(dashboards).toBe(true);
      expect(workflows).toBe(true);
      expect(hasOrganizationEntitlementWithLicenseGuard).not.toHaveBeenCalled();
    });

    test("returns false for self-hosted FRD / dashboards / workflows when not enabled", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = false;
      vi.mocked(getEnterpriseLicense).mockResolvedValue({
        ...defaultLicense,
        features: defaultFeatures,
      });

      const [frd, dashboards, workflows] = await Promise.all([
        getIsFeedbackDirectoriesEnabled("org_1"),
        getIsDashboardsEnabled("org_1"),
        getIsWorkflowsEnabled("org_1"),
      ]);

      expect(frd).toBe(false);
      expect(dashboards).toBe(false);
      expect(workflows).toBe(false);
      expect(hasOrganizationEntitlementWithLicenseGuard).not.toHaveBeenCalled();
    });
  });

  describe("getBiggerUploadFileSizePermission", () => {
    // Same grace-window split as the workspace limit below: the cached license stays active for the
    // window while the status already reports how the live check went, so "active" is the ordinary
    // case and the two others are a licensed instance mid-grace.
    test.each(["active", "unreachable", "expired"] as const)(
      "keeps the bigger upload size for self-hosted while the license is active and the status is %s",
      async (licenseStatus) => {
        vi.mocked(constants).IS_FORMBRICKS_CLOUD = false;
        vi.mocked(getOrganizationEntitlementsContext).mockResolvedValue({
          ...defaultEntitlementsContext,
          source: "self_hosted_license",
          licenseActive: true,
          licenseStatus,
        });

        const result = await getBiggerUploadFileSizePermission("org_1");

        expect(result).toBe(true);
      }
    );

    test("returns false for self-hosted once the license is no longer active", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = false;
      vi.mocked(getOrganizationEntitlementsContext).mockResolvedValue({
        ...defaultEntitlementsContext,
        source: "self_hosted_license",
        // Past the grace window the provider resolves the license as inactive, and the standard
        // upload cap applies again.
        licenseActive: false,
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
        limits: { ...defaultEntitlementsContext.limits, workspaces: 10 },
      });

      const result = await getBiggerUploadFileSizePermission("org_1");

      expect(result).toBe(true);
    });

    test("returns false on cloud for hobby-level capacity", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(getOrganizationEntitlementsContext).mockResolvedValue({
        ...defaultEntitlementsContext,
        licenseStatus: "active",
        limits: { ...defaultEntitlementsContext.limits, workspaces: 1 },
      });

      const result = await getBiggerUploadFileSizePermission("org_1");

      expect(result).toBe(false);
    });

    test("returns false on cloud when license status is not usable", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(getOrganizationEntitlementsContext).mockResolvedValue({
        ...defaultEntitlementsContext,
        licenseStatus: "expired",
        limits: { ...defaultEntitlementsContext.limits, workspaces: 10 },
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
        getIsContactsEnabled("org_1"),
        getIsTwoFactorAuthEnabled(),
        getIsSsoEnabled(),
      ]);

      expect(multiOrg).toBe(true);
      expect(contacts).toBe(false);
      expect(twoFactor).toBe(true);
      expect(sso).toBe(true);
    });

    test("returns false when features are unavailable", async () => {
      vi.mocked(getLicenseFeatures).mockResolvedValue(null);

      const [multiOrg, contacts, twoFactor, sso] = await Promise.all([
        getIsMultiOrgEnabled(),
        getIsContactsEnabled("org_1"),
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

      const result = await getIsSpamProtectionEnabled("org_1");

      expect(result).toBe(false);
      expect(hasOrganizationEntitlementWithLicenseGuard).not.toHaveBeenCalled();
    });

    test("uses cloud spam-protection entitlement when configured", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(hasOrganizationEntitlementWithLicenseGuard).mockResolvedValueOnce(true);

      const result = await getIsSpamProtectionEnabled("org_1");

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

      const result = await getIsSpamProtectionEnabled("org_1");

      expect(result).toBe(true);
    });
  });

  describe("getOrganizationWorkspacesLimit", () => {
    test("returns cloud workspaces limit when cloud license status allows usage", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(getOrganizationEntitlementsContext).mockResolvedValue({
        ...defaultEntitlementsContext,
        licenseStatus: "active",
        limits: { ...defaultEntitlementsContext.limits, workspaces: 10 },
      });

      const result = await getOrganizationWorkspacesLimit("org_1");

      expect(result).toBe(10);
    });

    test("returns Infinity when cloud workspaces limit is unbounded", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(getOrganizationEntitlementsContext).mockResolvedValue({
        ...defaultEntitlementsContext,
        licenseStatus: "no-license",
        limits: { ...defaultEntitlementsContext.limits, workspaces: null },
      });

      const result = await getOrganizationWorkspacesLimit("org_1");

      expect(result).toBe(Infinity);
    });

    test("falls back to the cloud Hobby limit when the license status does not allow usage", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
      vi.mocked(getOrganizationEntitlementsContext).mockResolvedValue({
        ...defaultEntitlementsContext,
        licenseStatus: "expired",
        limits: { ...defaultEntitlementsContext.limits, workspaces: 10 },
      });

      const result = await getOrganizationWorkspacesLimit("org_1");

      // The org's own entitlement (10) is deliberately ignored: an entitlement we cannot verify is
      // treated as no entitlement, so the free-tier allowance applies until the license resolves.
      expect(result).toBe(1);
    });

    test("returns Infinity for self-hosted when an active license grants unlimited workspaces", async () => {
      vi.mocked(constants).IS_FORMBRICKS_CLOUD = false;
      vi.mocked(getOrganizationEntitlementsContext).mockResolvedValue({
        ...defaultEntitlementsContext,
        source: "self_hosted_license",
        licenseStatus: "active",
        licenseFeatures: { ...defaultFeatures, workspaces: null },
        limits: { ...defaultEntitlementsContext.limits, workspaces: null },
      });

      const result = await getOrganizationWorkspacesLimit("org_1");

      expect(result).toBe(Infinity);
    });

    // One guard for the three shapes an unusable license can take, all of which the provider has
    // already resolved to the community cap. These prove only that this function reads the resolved
    // `limits.workspaces`; the cap *mapping* itself is proved where it happens, in
    // self-hosted-provider.test.ts ("defaults workspaces to the community limit when license is
    // inactive").
    test.each([
      {
        case: "a license that lapsed past the grace window",
        licenseActive: false,
        licenseStatus: "expired" as const,
        licenseFeatures: { ...defaultFeatures, workspaces: null },
      },
      {
        // Still active, but the check returned no features, so there is no allowance to read.
        case: "an active license carrying no features",
        licenseActive: true,
        licenseStatus: "active" as const,
        licenseFeatures: null,
      },
      {
        case: "no license key at all",
        licenseActive: false,
        licenseStatus: "no-license" as const,
        licenseFeatures: null,
      },
    ])(
      "returns the community limit for self-hosted with $case",
      async ({ licenseActive, licenseStatus, licenseFeatures }) => {
        vi.mocked(constants).IS_FORMBRICKS_CLOUD = false;
        vi.mocked(getOrganizationEntitlementsContext).mockResolvedValue({
          ...defaultEntitlementsContext,
          source: "self_hosted_license",
          licenseActive,
          licenseStatus,
          licenseFeatures,
          limits: { ...defaultEntitlementsContext.limits, workspaces: 1 },
        });

        const result = await getOrganizationWorkspacesLimit("org_1");

        expect(result).toBe(1);
      }
    );

    // The licensed allowance holds whatever the live check reported, which is the point of the fix:
    // "active" is the ordinary case, and both grace entries keep the cached license active for the
    // window (getFallbackLevel, license.ts:285-295) — "unreachable" when the check never completed,
    // "expired" when it completed and the key had lapsed.
    test.each(["active", "unreachable", "expired"] as const)(
      "keeps the licensed self-hosted workspace limit when the license status is %s",
      async (licenseStatus) => {
        vi.mocked(constants).IS_FORMBRICKS_CLOUD = false;
        vi.mocked(getOrganizationEntitlementsContext).mockResolvedValue({
          ...defaultEntitlementsContext,
          source: "self_hosted_license",
          licenseActive: true,
          licenseStatus,
          licenseFeatures: { ...defaultFeatures, workspaces: 5 },
          limits: { ...defaultEntitlementsContext.limits, workspaces: 5 },
        });

        const result = await getOrganizationWorkspacesLimit("org_1");

        expect(result).toBe(5);
      }
    );
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
