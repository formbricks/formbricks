import "server-only";
import { Organization } from "@prisma/client";
import {
  AUDIT_LOG_ENABLED,
  IS_FORMBRICKS_CLOUD,
  IS_RECAPTCHA_CONFIGURED,
  PROJECT_FEATURE_KEYS,
} from "@/lib/constants";
import type { TOrganizationPermissionContext } from "@/modules/billing/lib/organization-permission-context";
import { CLOUD_STRIPE_FEATURE_LOOKUP_KEYS } from "@/modules/billing/lib/stripe-catalog";
import { TEnterpriseLicenseFeatures } from "@/modules/ee/license-check/types/enterprise-license";
import { getEnterpriseLicense, getLicenseFeatures } from "./license";

const hasCloudEntitlementWithGuard = async (
  organizationId: string,
  featureLookupKey: string
): Promise<boolean> => {
  const { hasCloudEntitlementWithLicenseGuard } = await import("@/modules/billing/lib/feature-access");
  return hasCloudEntitlementWithLicenseGuard(organizationId, featureLookupKey);
};

// Helper function for feature permissions (e.g., removeBranding, whitelabel)
// On Cloud with organizationId: requires Stripe entitlement + enterprise license guard
// On Self-hosted: requires active license and feature enabled
const getFeaturePermission = async (
  context: TOrganizationPermissionContext,
  featureKey: keyof Pick<TEnterpriseLicenseFeatures, "removeBranding" | "whitelabel">
): Promise<boolean> => {
  const { organizationId } = context;

  if (IS_FORMBRICKS_CLOUD) {
    return hasCloudEntitlementWithGuard(organizationId, CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.HIDE_BRANDING);
  } else {
    const license = await getEnterpriseLicense();
    return license.active && !!license.features?.[featureKey];
  }
};

// Helper function for enterprise features that require CUSTOM plan on Cloud
// On Cloud with organizationId: requires Stripe entitlement + enterprise license guard
// On Self-hosted: requires active license AND feature enabled in license
const getCustomPlanFeaturePermission = async (
  context: TOrganizationPermissionContext,
  featureKey: keyof Pick<TEnterpriseLicenseFeatures, "accessControl" | "multiLanguageSurveys" | "quotas">
): Promise<boolean> => {
  const { billingPlan, organizationId } = context;

  if (IS_FORMBRICKS_CLOUD) {
    const featureLookupKeyMap: Record<string, string> = {
      accessControl: CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.RBAC,
      quotas: CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.QUOTA_MANAGEMENT,
      multiLanguageSurveys: CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.MULTI_LANGUAGE_SURVEYS,
    };
    const lookupKey = featureLookupKeyMap[featureKey];
    if (lookupKey) {
      return hasCloudEntitlementWithGuard(organizationId, lookupKey);
    }
    return billingPlan === PROJECT_FEATURE_KEYS.CUSTOM;
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

export const getRemoveBrandingPermission = async (
  context: TOrganizationPermissionContext
): Promise<boolean> => {
  return getFeaturePermission(context, "removeBranding");
};

export const getWhiteLabelPermission = async (context: TOrganizationPermissionContext): Promise<boolean> => {
  return getFeaturePermission(context, "whitelabel");
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

export const getIsQuotasEnabled = async (context: TOrganizationPermissionContext): Promise<boolean> => {
  return getCustomPlanFeaturePermission(context, "quotas");
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
  context: TOrganizationPermissionContext
): Promise<boolean> => {
  const { organizationId } = context;
  if (!IS_RECAPTCHA_CONFIGURED) return false;

  if (IS_FORMBRICKS_CLOUD) {
    return hasCloudEntitlementWithGuard(organizationId, CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.SPAM_PROTECTION);
  }

  const license = await getEnterpriseLicense();
  return license.active && !!license.features?.spamProtection;
};

export const getMultiLanguagePermission = async (
  context: TOrganizationPermissionContext
): Promise<boolean> => {
  return getCustomPlanFeaturePermission(context, "multiLanguageSurveys");
};

export const getAccessControlPermission = async (
  context: TOrganizationPermissionContext
): Promise<boolean> => {
  return getCustomPlanFeaturePermission(context, "accessControl");
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
