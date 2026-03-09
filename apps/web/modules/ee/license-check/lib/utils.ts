import "server-only";
import { AUDIT_LOG_ENABLED, IS_FORMBRICKS_CLOUD, IS_RECAPTCHA_CONFIGURED } from "@/lib/constants";
import { CLOUD_STRIPE_FEATURE_LOOKUP_KEYS } from "@/modules/billing/lib/stripe-catalog";
import type { TEnterpriseLicenseFeatures } from "@/modules/ee/license-check/types/enterprise-license";
import { hasOrganizationEntitlementWithLicenseGuard } from "@/modules/entitlements/lib/checks";
import { getOrganizationEntitlementsContext } from "@/modules/entitlements/lib/provider";
import { getEnterpriseLicense, getLicenseFeatures } from "./license";

// Helper function for feature permissions (e.g., removeBranding, whitelabel)
// On Cloud with organizationId: requires Stripe entitlement + enterprise license guard
// On Self-hosted: requires active license and feature enabled
const getFeaturePermission = async (
  organizationId: string,
  featureKey: keyof Pick<TEnterpriseLicenseFeatures, "removeBranding" | "whitelabel">
): Promise<boolean> => {
  if (IS_FORMBRICKS_CLOUD) {
    return hasOrganizationEntitlementWithLicenseGuard(
      organizationId,
      CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.HIDE_BRANDING
    );
  } else {
    const license = await getEnterpriseLicense();
    return license.active && !!license.features?.[featureKey];
  }
};

// Helper function for enterprise features that require CUSTOM plan on Cloud
// On Cloud with organizationId: requires Stripe entitlement + enterprise license guard
// On Self-hosted: requires active license AND feature enabled in license
const getCustomPlanFeaturePermission = async (
  organizationId: string,
  featureKey: keyof Pick<TEnterpriseLicenseFeatures, "accessControl" | "multiLanguageSurveys" | "quotas">
): Promise<boolean> => {
  if (IS_FORMBRICKS_CLOUD) {
    const featureLookupKeyMap: Record<string, string> = {
      accessControl: CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.RBAC,
      quotas: CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.QUOTA_MANAGEMENT,
      multiLanguageSurveys: CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.MULTI_LANGUAGE_SURVEYS,
    };
    const lookupKey = featureLookupKeyMap[featureKey];
    if (lookupKey) {
      return hasOrganizationEntitlementWithLicenseGuard(organizationId, lookupKey);
    }
    return false;
  }

  const license = await getEnterpriseLicense();
  if (!license.active) return false;
  const isFeatureEnabled = license.features?.[featureKey] ?? false;
  if (!isFeatureEnabled) return false;
  return true;
};

// Helper function for license-only feature flags (no billing plan check)
// Returns true only if the license is active AND the specific feature is enabled in the license
// Used for features that are controlled purely by the license key, not billing plans
const getSpecificFeatureFlag = async (
  featureKey: keyof Pick<
    TEnterpriseLicenseFeatures,
    "isMultiOrgEnabled" | "contacts" | "twoFactorAuth" | "sso" | "auditLogs"
  >
): Promise<boolean> => {
  const licenseFeatures = await getLicenseFeatures();
  if (!licenseFeatures) return false;
  return typeof licenseFeatures[featureKey] === "boolean" ? licenseFeatures[featureKey] : false;
};

export const getRemoveBrandingPermission = async (organizationId: string): Promise<boolean> => {
  return getFeaturePermission(organizationId, "removeBranding");
};

export const getWhiteLabelPermission = async (organizationId: string): Promise<boolean> => {
  return getFeaturePermission(organizationId, "whitelabel");
};

export const getBiggerUploadFileSizePermission = async (organizationId: string): Promise<boolean> => {
  const entitlementsContext = await getOrganizationEntitlementsContext(organizationId);

  if (!IS_FORMBRICKS_CLOUD) {
    return entitlementsContext.licenseStatus === "active";
  }

  const hasPaidCloudCapacity =
    entitlementsContext.limits.projects === null ||
    (typeof entitlementsContext.limits.projects === "number" && entitlementsContext.limits.projects > 1);
  const licenseAllowsUsage =
    entitlementsContext.licenseStatus === "active" || entitlementsContext.licenseStatus === "no-license";

  return hasPaidCloudCapacity && licenseAllowsUsage;
};

export const getIsMultiOrgEnabled = async (): Promise<boolean> => {
  return getSpecificFeatureFlag("isMultiOrgEnabled");
};

export const getIsContactsEnabled = async (): Promise<boolean> => {
  return getSpecificFeatureFlag("contacts");
};

export const getIsTwoFactorAuthEnabled = async (): Promise<boolean> => {
  return getSpecificFeatureFlag("twoFactorAuth");
};

export const getIsSsoEnabled = async (): Promise<boolean> => {
  return getSpecificFeatureFlag("sso");
};

export const getIsQuotasEnabled = async (organizationId: string): Promise<boolean> => {
  return getCustomPlanFeaturePermission(organizationId, "quotas");
};

export const getIsAuditLogsEnabled = async (): Promise<boolean> => {
  if (!AUDIT_LOG_ENABLED) return false;
  return getSpecificFeatureFlag("auditLogs");
};

export const getIsSamlSsoEnabled = async (): Promise<boolean> => {
  if (IS_FORMBRICKS_CLOUD) {
    return false;
  }
  const licenseFeatures = await getLicenseFeatures();
  if (!licenseFeatures) return false;
  return licenseFeatures.sso && licenseFeatures.saml;
};

export const getIsSpamProtectionEnabled = async (organizationId: string): Promise<boolean> => {
  if (!IS_RECAPTCHA_CONFIGURED) return false;

  if (IS_FORMBRICKS_CLOUD) {
    return hasOrganizationEntitlementWithLicenseGuard(
      organizationId,
      CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.SPAM_PROTECTION
    );
  }

  const license = await getEnterpriseLicense();
  return license.active && !!license.features?.spamProtection;
};

export const getMultiLanguagePermission = async (organizationId: string): Promise<boolean> => {
  return getCustomPlanFeaturePermission(organizationId, "multiLanguageSurveys");
};

export const getAccessControlPermission = async (organizationId: string): Promise<boolean> => {
  return getCustomPlanFeaturePermission(organizationId, "accessControl");
};

export const getOrganizationProjectsLimit = async (organizationId: string): Promise<number> => {
  const entitlementsContext = await getOrganizationEntitlementsContext(organizationId);

  if (IS_FORMBRICKS_CLOUD) {
    const cloudLicenseAllowsLimits =
      entitlementsContext.licenseStatus === "active" || entitlementsContext.licenseStatus === "no-license";
    if (!cloudLicenseAllowsLimits) return 3;
    return entitlementsContext.limits.projects ?? Infinity;
  }

  if (
    entitlementsContext.licenseStatus === "active" &&
    entitlementsContext.licenseFeatures?.projects != null
  ) {
    return entitlementsContext.licenseFeatures.projects;
  }

  return 3;
};
