import type { TOrganizationStripeSubscriptionStatus } from "@formbricks/types/organizations";
import { CLOUD_STRIPE_FEATURE_LOOKUP_KEYS } from "@/modules/billing/lib/stripe-catalog";
import type {
  TEnterpriseLicenseFeatures,
  TLicenseStatus,
} from "@/modules/ee/license-check/types/enterprise-license";

export type TEntitlementSource = "cloud_stripe" | "self_hosted_license";
export type TKnownEntitlementFeature =
  (typeof CLOUD_STRIPE_FEATURE_LOOKUP_KEYS)[keyof typeof CLOUD_STRIPE_FEATURE_LOOKUP_KEYS];
export type TUsageLimitEntitlementFeature = `responses-${number}`;
export type TEntitlementFeature = TKnownEntitlementFeature | TUsageLimitEntitlementFeature;

const KNOWN_ENTITLEMENT_FEATURES: readonly TKnownEntitlementFeature[] = Object.values(
  CLOUD_STRIPE_FEATURE_LOOKUP_KEYS
) as TKnownEntitlementFeature[];

export const isEntitlementFeature = (feature: string): feature is TEntitlementFeature => {
  if ((KNOWN_ENTITLEMENT_FEATURES as readonly string[]).includes(feature)) {
    return true;
  }

  return /^responses-\d+$/.test(feature);
};

export type TEntitlementLimits = {
  projects: number | null;
  monthlyResponses: number | null;
};

export type TOrganizationEntitlementsContext = {
  organizationId: string;
  source: TEntitlementSource;
  features: TEntitlementFeature[];
  limits: TEntitlementLimits;
  licenseStatus: TLicenseStatus;
  licenseFeatures: TEnterpriseLicenseFeatures | null;
  stripeCustomerId: string | null;
  subscriptionStatus: TOrganizationStripeSubscriptionStatus | null;
  usageCycleAnchor: Date | null;
};
