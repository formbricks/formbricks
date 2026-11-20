import { TOrganizationBilling } from "@formbricks/types/organizations";

type TBillingInput = Pick<TOrganizationBilling, "usageCycleAnchor"> & {
  stripe?: Pick<NonNullable<TOrganizationBilling["stripe"]>, "subscriptionStatus" | "trialStart">;
};

export type TUsageCycleWindow = {
  start: Date;
  end: Date;
};

const getUtcMonthDate = (
  year: number,
  monthIndex: number,
  anchorDay: number,
  hours: number,
  minutes: number,
  seconds: number,
  milliseconds: number
): Date => {
  const lastDayOfMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const clampedDay = Math.min(anchorDay, lastDayOfMonth);

  return new Date(Date.UTC(year, monthIndex, clampedDay, hours, minutes, seconds, milliseconds));
};

const addUtcMonthsFromAnchor = (anchor: Date, monthOffset: number): Date => {
  const anchorYear = anchor.getUTCFullYear();
  const anchorMonth = anchor.getUTCMonth();
  const anchorDay = anchor.getUTCDate();
  const targetMonthIndex = anchorMonth + monthOffset;
  const targetYear = anchorYear + Math.floor(targetMonthIndex / 12);
  const normalizedMonthIndex = ((targetMonthIndex % 12) + 12) % 12;

  return getUtcMonthDate(
    targetYear,
    normalizedMonthIndex,
    anchorDay,
    anchor.getUTCHours(),
    anchor.getUTCMinutes(),
    anchor.getUTCSeconds(),
    anchor.getUTCMilliseconds()
  );
};

const getCalendarMonthWindow = (now: Date): TUsageCycleWindow => {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  return { start, end };
};

export const getMonthlyUsageCycleWindow = (
  usageCycleAnchor: Date | null,
  now = new Date()
): TUsageCycleWindow => {
  if (!usageCycleAnchor) {
    return getCalendarMonthWindow(now);
  }

  const anchor = new Date(usageCycleAnchor);

  let monthOffset =
    (now.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + (now.getUTCMonth() - anchor.getUTCMonth());

  let start = addUtcMonthsFromAnchor(anchor, monthOffset);

  while (start > now) {
    monthOffset -= 1;
    start = addUtcMonthsFromAnchor(anchor, monthOffset);
  }

  let end = addUtcMonthsFromAnchor(anchor, monthOffset + 1);

  while (end <= now) {
    monthOffset += 1;
    start = addUtcMonthsFromAnchor(anchor, monthOffset);
    end = addUtcMonthsFromAnchor(anchor, monthOffset + 1);
  }

  return { start, end };
};

const getTrialStart = (billing: TBillingInput): Date | null => {
  if (billing.stripe?.subscriptionStatus !== "trialing" || !billing.stripe.trialStart) {
    return null;
  }

  const trialStart = new Date(billing.stripe.trialStart);
  return Number.isFinite(trialStart.getTime()) ? trialStart : null;
};

export const getBillingUsageCycleWindow = (billing: TBillingInput, now = new Date()): TUsageCycleWindow => {
  const window = getMonthlyUsageCycleWindow(billing.usageCycleAnchor, now);

  // Stripe anchors a trialing subscription at the trial end, so the month counted back from it can start
  // before the trial did. The trial is the subscription's first period, so the window starts there.
  const trialStart = getTrialStart(billing);
  if (trialStart && trialStart > window.start && trialStart < window.end) {
    return { start: trialStart, end: window.end };
  }

  return window;
};

/**
 * Whether the app shell reads the Cloud monthly response count: the limits banner needs a response limit,
 * and the Hobby warnings and the trial sidebar card show the count. Any other plan skips the count, which
 * scans every response the organization collected this cycle (ENG-3789).
 */
export const needsMonthlyResponseCount = (
  billing: Pick<TOrganizationBilling, "limits" | "stripe"> | null | undefined
): boolean =>
  billing?.limits?.monthly?.responses != null ||
  billing?.stripe?.plan === "hobby" ||
  billing?.stripe?.subscriptionStatus === "trialing";
