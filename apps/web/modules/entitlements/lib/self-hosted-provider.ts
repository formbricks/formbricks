import "server-only";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getOrganization } from "@/lib/organization/service";
import { CLOUD_STRIPE_FEATURE_LOOKUP_KEYS } from "@/modules/billing/lib/stripe-catalog";
import { getEnterpriseLicense } from "@/modules/ee/license-check/lib/license";
import type { TEntitlementFeature, TOrganizationEntitlementsContext } from "./types";

const mapLicenseFeaturesToEntitlements = (
  features: TOrganizationEntitlementsContext["licenseFeatures"]
): TEntitlementFeature[] => {
  if (!features) return [];

  const entitlementKeys: TEntitlementFeature[] = [];

  if (features.removeBranding || features.whitelabel) {
    entitlementKeys.push(CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.HIDE_BRANDING);
  }
  if (features.accessControl) {
    entitlementKeys.push(CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.RBAC);
  }
  if (features.quotas) {
    entitlementKeys.push(CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.QUOTA_MANAGEMENT);
  }
  if (features.spamProtection) {
    entitlementKeys.push(CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.SPAM_PROTECTION);
  }
  if (features.contacts) {
    entitlementKeys.push(CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.CONTACTS);
  }

  return entitlementKeys;
};

export const getSelfHostedOrganizationEntitlementsContext = async (
  organizationId: string
): Promise<TOrganizationEntitlementsContext> => {
  const [organization, license] = await Promise.all([
    getOrganization(organizationId),
    getEnterpriseLicense(),
  ]);

  if (!organization) {
    throw new ResourceNotFoundError("Organization", organizationId);
  }

  return {
    organizationId,
    source: "self_hosted_license",
    features: license.active ? mapLicenseFeaturesToEntitlements(license.features) : [],
    limits: {
      projects: license.active ? (license.features?.projects ?? 3) : 3,
      // Self-hosted response limits are not license-server-managed today.
      monthlyResponses: null,
    },
    licenseStatus: license.status,
    licenseFeatures: license.features,
    stripeCustomerId: null,
    subscriptionStatus: null,
    usageCycleAnchor: null,
  };
};
