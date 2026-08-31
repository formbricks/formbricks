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
  workspaces: number | null;
  monthlyResponses: number | null;
  // Included monthly workflow runs (ENG-1936). null = not metered / unlimited (e.g. self-hosted,
  // where workflows are gated by the boolean license feature rather than metered).
  monthlyWorkflowRuns: number | null;
};

export type TOrganizationEntitlementsContext = {
  organizationId: string;
  source: TEntitlementSource;
  features: TEntitlementFeature[];
  limits: TEntitlementLimits;
  // The cached license's `active` flag, which stays true for the whole grace window while
  // `licenseStatus` already reports "unreachable" or "expired" (see getFallbackLevel in
  // license.ts). Gate self-hosted entitlements on this, never on `licenseStatus` — the status
  // string drops a licensed instance to Community Edition for the whole window.
  licenseActive: boolean;
  licenseStatus: TLicenseStatus;
  licenseFeatures: TEnterpriseLicenseFeatures | null;
  stripeCustomerId: string | null;
  subscriptionStatus: TOrganizationStripeSubscriptionStatus | null;
  usageCycleAnchor: Date | null;
};
