import { TOrganizationBilling } from "@formbricks/types/organizations";

// Function to calculate billing period start date based on organization plan and billing period
export const getBillingPeriodStartDate = (billing: TOrganizationBilling): Date => {
  const now = new Date();
  if (billing.plan === "free") {
    // For free plans, use the first day of the current calendar month
    return new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (billing.period === "yearly" && billing.periodStart) {
    // For yearly plans, use the same day of the month as the original subscription date
    const periodStart = new Date(billing.periodStart);
    const subscriptionDay = periodStart.getDate();

    // Helper function to get the last day of a specific month
    const getLastDayOfMonth = (year: number, month: number): number => {
      // Create a date for the first day of the next month, then subtract one day
      return new Date(year, month + 1, 0).getDate();
    };

    // Calculate the adjusted day for the current month
    const lastDayOfCurrentMonth = getLastDayOfMonth(now.getFullYear(), now.getMonth());
    const adjustedCurrentMonthDay = Math.min(subscriptionDay, lastDayOfCurrentMonth);

    // Calculate the current month's adjusted subscription date
    const currentMonthSubscriptionDate = new Date(now.getFullYear(), now.getMonth(), adjustedCurrentMonthDay);

    // If today is before the subscription day in the current month (or its adjusted equivalent),
    // we should use the previous month's subscription day as our start date
    if (now.getDate() < adjustedCurrentMonthDay) {
      // Calculate previous month and year
      const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

      // Calculate the adjusted day for the previous month
      const lastDayOfPreviousMonth = getLastDayOfMonth(prevYear, prevMonth);
      const adjustedPreviousMonthDay = Math.min(subscriptionDay, lastDayOfPreviousMonth);

      // Return the adjusted previous month date
      return new Date(prevYear, prevMonth, adjustedPreviousMonthDay);
    } else {
      return currentMonthSubscriptionDate;
    }
  } else if (billing.period === "monthly" && billing.periodStart) {
    // For monthly plans with a periodStart, use that date
    return new Date(billing.periodStart);
  } else {
    // For other plans, use the periodStart from billing
    if (!billing.periodStart) {
      throw new Error("billing period start is not set");
    }
    return new Date(billing.periodStart);
  }
};
