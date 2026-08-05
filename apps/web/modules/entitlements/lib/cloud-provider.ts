import "server-only";
import { logger } from "@formbricks/logger";
import {
  getDefaultOrganizationBilling,
  getOrganizationBillingWithReadThroughSync,
} from "@/modules/ee/billing/lib/organization-billing";
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
    logger.warn({ organizationId }, "Organization billing not found, using default entitlements");
    const defaultBilling = getDefaultOrganizationBilling();

    return {
      organizationId,
      source: "cloud_stripe",
      features: [],
      limits: {
        workspaces: defaultBilling.limits?.workspaces ?? null,
        monthlyResponses: defaultBilling.limits?.monthly?.responses ?? null,
        monthlyWorkflowRuns: defaultBilling.limits?.monthly?.workflowRuns ?? null,
      },
      licenseStatus: license.status,
      licenseFeatures: license.features,
      stripeCustomerId: null,
      subscriptionStatus: null,
      usageCycleAnchor: null,
    };
  }

  return {
    organizationId,
    source: "cloud_stripe",
    features: (billing.stripe?.features ?? []).filter(isEntitlementFeature),
    limits: {
      workspaces: billing.limits?.workspaces ?? null,
      monthlyResponses: billing.limits?.monthly?.responses ?? null,
      monthlyWorkflowRuns: billing.limits?.monthly?.workflowRuns ?? null,
    },
    licenseStatus: license.status,
    licenseFeatures: license.features,
    stripeCustomerId: billing.stripeCustomerId ?? null,
    subscriptionStatus: billing.stripe?.subscriptionStatus ?? null,
    usageCycleAnchor: toDateOrNull(billing.usageCycleAnchor),
  };
};
