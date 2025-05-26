import "server-only";
import {
  AUDIT_LOG_ENABLED,
  IS_FORMBRICKS_CLOUD,
  IS_RECAPTCHA_CONFIGURED,
  PROJECT_FEATURE_KEYS,
} from "@/lib/constants";
import { TEnterpriseLicenseFeatures } from "@/modules/ee/license-check/types/enterprise-license";
import { Organization } from "@prisma/client";
import { getEnterpriseLicense, getLicenseFeatures } from "./license";

// Helper function for feature permissions (e.g., removeBranding, whitelabel)
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

export const getRoleManagementPermission = async (
  billingPlan: Organization["billing"]["plan"]
): Promise<boolean> => {
  const license = await getEnterpriseLicense();

  if (IS_FORMBRICKS_CLOUD)
    return (
      license.active &&
      (billingPlan === PROJECT_FEATURE_KEYS.SCALE || billingPlan === PROJECT_FEATURE_KEYS.ENTERPRISE)
    );
  else if (!IS_FORMBRICKS_CLOUD) return license.active;
  return false;
};

export const getBiggerUploadFileSizePermission = async (
  billingPlan: Organization["billing"]["plan"]
): Promise<boolean> => {
  const license = await getEnterpriseLicense();

  if (IS_FORMBRICKS_CLOUD) return billingPlan !== PROJECT_FEATURE_KEYS.FREE && license.active;
  else if (!IS_FORMBRICKS_CLOUD) return license.active;
  return false;
};

export const getMultiLanguagePermission = async (
  billingPlan: Organization["billing"]["plan"]
): Promise<boolean> => {
  const license = await getEnterpriseLicense();

  if (IS_FORMBRICKS_CLOUD)
    return (
      license.active &&
      (billingPlan === PROJECT_FEATURE_KEYS.SCALE || billingPlan === PROJECT_FEATURE_KEYS.ENTERPRISE)
    );
  else if (!IS_FORMBRICKS_CLOUD) return license.active;
  return false;
};

// Helper function for simple boolean feature flags
const getSpecificFeatureFlag = async (
  featureKey: keyof Pick<
    TEnterpriseLicenseFeatures,
    "isMultiOrgEnabled" | "contacts" | "twoFactorAuth" | "sso"
  >
): Promise<boolean> => {
  const licenseFeatures = await getLicenseFeatures();
  if (!licenseFeatures) return false;
  return typeof licenseFeatures[featureKey] === "boolean" ? licenseFeatures[featureKey] : false;
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
      license.active &&
      !!license.features?.spamProtection &&
      (billingPlan === PROJECT_FEATURE_KEYS.SCALE || billingPlan === PROJECT_FEATURE_KEYS.ENTERPRISE)
    );
  }

  return license.active && !!license.features?.spamProtection;
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

export const getIsAuditLogsEnabled = async (): Promise<boolean> => {
  const license = await getEnterpriseLicense();

  return license.active && !!license.features?.auditLogs && AUDIT_LOG_ENABLED;
};
