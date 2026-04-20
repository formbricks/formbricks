import "server-only";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import {
  type TCloudBillingInterval,
  type TOrganizationStripePendingChange,
  type TOrganizationStripeSubscriptionStatus,
} from "@formbricks/types/organizations";
import { getBillingUsageCycleWindow } from "@/lib/utils/billing";
import { getOrganizationBillingWithReadThroughSync } from "./organization-billing";

export type TCloudBillingDisplayPlan = "hobby" | "pro" | "scale" | "custom" | "unknown";

export type TCloudBillingDisplayContext = {
  organizationId: string;
  currentCloudPlan: TCloudBillingDisplayPlan;
  currentBillingInterval: TCloudBillingInterval | null;
  currentSubscriptionStatus: TOrganizationStripeSubscriptionStatus | null;
  pendingChange: TOrganizationStripePendingChange | null;
  trialDaysRemaining: number | null;
  usageCycleStart: Date;
  usageCycleEnd: Date;
  billing: NonNullable<Awaited<ReturnType<typeof getOrganizationBillingWithReadThroughSync>>>;
};

const resolveCurrentCloudPlan = (
  billing: NonNullable<Awaited<ReturnType<typeof getOrganizationBillingWithReadThroughSync>>>
): TCloudBillingDisplayPlan => {
  return billing.stripe?.plan ?? "unknown";
};

const resolveCurrentSubscriptionStatus = (
  billing: NonNullable<Awaited<ReturnType<typeof getOrganizationBillingWithReadThroughSync>>>
): TOrganizationStripeSubscriptionStatus | null => {
  return billing.stripe?.subscriptionStatus ?? null;
};

const resolveCurrentBillingInterval = (
  billing: NonNullable<Awaited<ReturnType<typeof getOrganizationBillingWithReadThroughSync>>>
): TCloudBillingInterval | null => {
  return billing.stripe?.interval ?? null;
};

const resolvePendingChange = (
  billing: NonNullable<Awaited<ReturnType<typeof getOrganizationBillingWithReadThroughSync>>>
): TOrganizationStripePendingChange | null => {
  return billing.stripe?.pendingChange ?? null;
};

const MS_PER_DAY = 86_400_000;

const resolveTrialDaysRemaining = (
  billing: NonNullable<Awaited<ReturnType<typeof getOrganizationBillingWithReadThroughSync>>>
): number | null => {
  if (billing.stripe?.subscriptionStatus !== "trialing" || !billing.stripe.trialEnd) {
    return null;
  }

  const trialEndDate = new Date(billing.stripe.trialEnd);
  if (!Number.isFinite(trialEndDate.getTime())) {
    return null;
  }
  return Math.ceil((trialEndDate.getTime() - Date.now()) / MS_PER_DAY);
};

export const getCloudBillingDisplayContext = async (
  organizationId: string
): Promise<TCloudBillingDisplayContext> => {
  const billing = await getOrganizationBillingWithReadThroughSync(organizationId);

  if (!billing) {
    throw new ResourceNotFoundError("OrganizationBilling", organizationId);
  }

  const usageCycleWindow = getBillingUsageCycleWindow(billing);

  return {
    organizationId,
    currentCloudPlan: resolveCurrentCloudPlan(billing),
    currentBillingInterval: resolveCurrentBillingInterval(billing),
    currentSubscriptionStatus: resolveCurrentSubscriptionStatus(billing),
    pendingChange: resolvePendingChange(billing),
    trialDaysRemaining: resolveTrialDaysRemaining(billing),
    usageCycleStart: usageCycleWindow.start,
    usageCycleEnd: usageCycleWindow.end,
    billing,
  };
};
