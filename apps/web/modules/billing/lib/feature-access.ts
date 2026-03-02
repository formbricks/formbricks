import "server-only";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getEnterpriseLicense } from "@/modules/ee/license-check/lib/license";
import { TEnterpriseLicenseFeatures } from "@/modules/ee/license-check/types/enterprise-license";
import { getOrganizationBillingWithReadThroughSync } from "./organization-billing";
import { CLOUD_STRIPE_FEATURE_LOOKUP_KEYS } from "./stripe-catalog";

const LICENSE_GUARDED_ENTITLEMENTS: Partial<Record<string, keyof TEnterpriseLicenseFeatures>> = {
  // Only features represented in the enterprise license need an additional feature-level guard.
  [CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.HIDE_BRANDING]: "removeBranding",
  [CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.QUOTA_MANAGEMENT]: "quotas",
  [CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.RBAC]: "accessControl",
  [CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.SPAM_PROTECTION]: "spamProtection",
  [CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.MULTI_LANGUAGE_SURVEYS]: "multiLanguageSurveys",
};

export const hasCloudEntitlement = async (
  organizationId: string,
  featureLookupKey: string
): Promise<boolean> => {
  if (!IS_FORMBRICKS_CLOUD) return false;

  const billing = await getOrganizationBillingWithReadThroughSync(organizationId);
  const features = billing?.stripe?.features ?? [];

  return features.includes(featureLookupKey);
};

export const hasCloudEntitlementWithLicenseGuard = async (
  organizationId: string,
  featureLookupKey: string
): Promise<boolean> => {
  if (!IS_FORMBRICKS_CLOUD) return false;

  const hasEntitlement = await hasCloudEntitlement(organizationId, featureLookupKey);
  if (!hasEntitlement) return false;

  const license = await getEnterpriseLicense();
  if (license.status === "no-license") return true;
  if (!license.active) return false;

  const mappedLicenseFeature = LICENSE_GUARDED_ENTITLEMENTS[featureLookupKey];
  if (!mappedLicenseFeature) return true;

  return !!license.features?.[mappedLicenseFeature];
};
