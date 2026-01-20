import "server-only";
import { Organization } from "@prisma/client";
import {
  AUDIT_LOG_ENABLED,
  IS_FORMBRICKS_CLOUD,
  IS_RECAPTCHA_CONFIGURED,
  PROJECT_FEATURE_KEYS,
} from "@/lib/constants";
import { TEnterpriseLicenseFeatures } from "@/modules/ee/license-check/types/enterprise-license";
import { getEnterpriseLicense, getLicenseFeatures } from "./license";

// Helper function for feature permissions (e.g., removeBranding, whitelabel)
// On Cloud: requires active license and non-FREE plan
// On Self-hosted: requires active license and feature enabled
const getFeaturePermission = async (
  billingPlan: Organization["billing"]["plan"],
  featureKey: keyof Pick<TEnterpriseLicenseFeatures, "removeBranding" | "whitelabel">
): Promise<boolean> => {
  const license = await getEnterpriseLicense();

  if (IS_FORMBRICKS_CLOUD) {
    return license.active && billingPlan !== PROJECT_FEATURE_KEYS.FREE;
  } else {
    return license.active && !!license.features?.[featureKey];
  }
};

// Helper function for enterprise features that require CUSTOM plan on Cloud
// On Cloud: requires active license AND CUSTOM billing plan
// On Self-hosted: requires active license (backwards compat for older licenses)
const getCustomPlanFeaturePermission = async (
  billingPlan: Organization["billing"]["plan"],
  featureKey: keyof Pick<TEnterpriseLicenseFeatures, "accessControl" | "multiLanguageSurveys" | "quotas">
): Promise<boolean> => {
  const license = await getEnterpriseLicense();

  if (!license.active) return false;

  if (IS_FORMBRICKS_CLOUD) {
    return billingPlan === PROJECT_FEATURE_KEYS.CUSTOM;
  } else {
    return license.features?.[featureKey] ?? false;
  }
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

export const getRemoveBrandingPermission = async (
  billingPlan: Organization["billing"]["plan"]
): Promise<boolean> => {
  return getFeaturePermission(billingPlan, "removeBranding");
};

export const getWhiteLabelPermission = async (
  billingPlan: Organization["billing"]["plan"]
): Promise<boolean> => {
  return getFeaturePermission(billingPlan, "whitelabel");
};

export const getBiggerUploadFileSizePermission = async (
  billingPlan: Organization["billing"]["plan"]
): Promise<boolean> => {
  const license = await getEnterpriseLicense();

  if (IS_FORMBRICKS_CLOUD) return billingPlan !== PROJECT_FEATURE_KEYS.FREE && license.active;
  else if (!IS_FORMBRICKS_CLOUD) return license.active;
  return false;
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

export const getIsQuotasEnabled = async (billingPlan: Organization["billing"]["plan"]): Promise<boolean> => {
  return getCustomPlanFeaturePermission(billingPlan, "quotas");
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

export const getIsSpamProtectionEnabled = async (
  billingPlan: Organization["billing"]["plan"]
): Promise<boolean> => {
  if (!IS_RECAPTCHA_CONFIGURED) return false;

  const license = await getEnterpriseLicense();

  if (IS_FORMBRICKS_CLOUD) {
    return (
      license.active && !!license.features?.spamProtection && billingPlan === PROJECT_FEATURE_KEYS.CUSTOM
    );
  }

  return license.active && !!license.features?.spamProtection;
};

export const getMultiLanguagePermission = async (
  billingPlan: Organization["billing"]["plan"]
): Promise<boolean> => {
  return getCustomPlanFeaturePermission(billingPlan, "multiLanguageSurveys");
};

export const getAccessControlPermission = async (
  billingPlan: Organization["billing"]["plan"]
): Promise<boolean> => {
  return getCustomPlanFeaturePermission(billingPlan, "accessControl");
};

export const getOrganizationProjectsLimit = async (
  limits: Organization["billing"]["limits"]
): Promise<number> => {
  const license = await getEnterpriseLicense();

  let limit: number;

  if (IS_FORMBRICKS_CLOUD) {
    limit = license.active ? (limits.projects ?? Infinity) : 3;
  } else {
    limit = license.active && license.features?.projects != null ? license.features.projects : 3;
  }
  return limit;
};
