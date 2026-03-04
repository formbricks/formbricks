import { TOrganizationBilling } from "@formbricks/types/organizations";

type TBillingInput = Omit<TOrganizationBilling, "periodStart"> & {
  periodStart: Date | null;
};

// Determine the start date for usage counters.
// Stripe is the source of truth in cloud mode; when periodStart is unavailable, fallback to calendar month.
export const getBillingPeriodStartDate = (billing: TBillingInput): Date => {
  if (billing.periodStart) {
    return new Date(billing.periodStart);
  }

  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};
