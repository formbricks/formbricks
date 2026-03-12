import "server-only";
import { CLOUD_STRIPE_FEATURE_LOOKUP_KEYS } from "@/modules/billing/lib/stripe-catalog";
import type { TEnterpriseLicenseFeatures } from "@/modules/ee/license-check/types/enterprise-license";
import { getOrganizationEntitlementsContext } from "./provider";
import { type TEntitlementFeature, isEntitlementFeature } from "./types";

const LICENSE_GUARDED_ENTITLEMENTS: Partial<Record<string, keyof TEnterpriseLicenseFeatures>> = {
  "hide-branding": "removeBranding",
  "quota-management": "quotas",
  rbac: "accessControl",
  "spam-protection": "spamProtection",
  contacts: "contacts",
};

const TRIAL_RESTRICTED_ENTITLEMENT_KEYS = [
  CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.FOLLOW_UPS,
  CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.CUSTOM_LINKS_IN_SURVEYS,
  CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.CUSTOM_REDIRECT_URL,
] as const satisfies readonly TEntitlementFeature[];

const isTrialRestrictedEntitlement = (featureLookupKey: TEntitlementFeature): boolean =>
  (TRIAL_RESTRICTED_ENTITLEMENT_KEYS as readonly TEntitlementFeature[]).includes(featureLookupKey);

export const hasOrganizationEntitlement = async (
  organizationId: string,
  featureLookupKey: string
): Promise<boolean> => {
  const context = await getOrganizationEntitlementsContext(organizationId);

  if (!isEntitlementFeature(featureLookupKey)) {
    return false;
  }

  return context.features.includes(featureLookupKey);
};

export const hasOrganizationEntitlementWithLicenseGuard = async (
  organizationId: string,
  featureLookupKey: string
): Promise<boolean> => {
  const context = await getOrganizationEntitlementsContext(organizationId);
  if (!isEntitlementFeature(featureLookupKey)) {
    return false;
  }

  if (!context.features.includes(featureLookupKey)) {
    return false;
  }

  if (
    context.source === "cloud_stripe" &&
    context.subscriptionStatus === "trialing" &&
    isTrialRestrictedEntitlement(featureLookupKey)
  ) {
    return false;
  }

  if (context.licenseStatus === "no-license") {
    return true;
  }

  if (context.licenseStatus !== "active") {
    return false;
  }

  const mappedLicenseFeature = LICENSE_GUARDED_ENTITLEMENTS[featureLookupKey];
  if (!mappedLicenseFeature) {
    return true;
  }

  return !!context.licenseFeatures?.[mappedLicenseFeature];
};

export const getOrganizationEntitlementLimits = async (organizationId: string) => {
  const context = await getOrganizationEntitlementsContext(organizationId);
  return context.limits;
};
