import "server-only";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getOrganizationBillingWithReadThroughSync } from "@/modules/billing/lib/organization-billing";
import { getEnterpriseLicense } from "@/modules/ee/license-check/lib/license";
import { type TOrganizationEntitlementsContext, isEntitlementFeature } from "./types";

const toDateOrNull = (value: Date | string | null | undefined): Date | null => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getCloudOrganizationEntitlementsContext = async (
  organizationId: string
): Promise<TOrganizationEntitlementsContext> => {
  const [billing, license] = await Promise.all([
    getOrganizationBillingWithReadThroughSync(organizationId),
    getEnterpriseLicense(),
  ]);

  if (!billing) {
    throw new ResourceNotFoundError("OrganizationBilling", organizationId);
  }

  return {
    organizationId,
    source: "cloud_stripe",
    features: (billing.stripe?.features ?? []).filter(isEntitlementFeature),
    limits: {
      projects: billing.limits?.projects ?? null,
      monthlyResponses: billing.limits?.monthly?.responses ?? null,
      monthlyMiu: billing.limits?.monthly?.miu ?? null,
    },
    licenseStatus: license.status,
    licenseFeatures: license.features,
    stripeCustomerId: billing.stripeCustomerId ?? null,
    periodStart: toDateOrNull(billing.periodStart),
  };
};
