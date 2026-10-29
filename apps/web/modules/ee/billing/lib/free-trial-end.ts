import type Stripe from "stripe";

const SECONDS_PER_DAY = 86_400;

/**
 * Trial end as Unix seconds, `days` whole days from `nowMs`. Plain seconds arithmetic — never rounded to
 * midnight or computed in a time zone — so the trial end and the cancellation can share it exactly and a
 * DST boundary can't open a gap between them.
 */
export const getFreeTrialEndUnix = (days: number, nowMs: number = Date.now()): number =>
  Math.floor(nowMs / 1000) + days * SECONDS_PER_DAY;

/**
 * Stripe parameters that make a free trial end on Hobby instead of a paid invoice (ENG-4035).
 *
 * `missing_payment_method: "cancel"` alone only covers trials with no card: once any card is saved — on the
 * subscription or just on the customer — Stripe bills the paid plan at `trial_end`. Cancelling the
 * subscription at the SAME second the trial ends closes that gap on Stripe's side, card or no card, even if
 * our app never processes the expiry; the deletion webhook then puts the org on Hobby. Any gap between the
 * two timestamps is billed as a proration, hence one shared value and `proration_behavior: "none"`.
 *
 * Only an explicit, successfully paid upgrade removes `cancel_at` (in the same update that ends the trial).
 * Note: sending `cancel_at_period_end: false` to Stripe also clears `cancel_at`.
 */
export const buildFreeTrialEndParams = (trialEndUnix: number) =>
  ({
    trial_end: trialEndUnix,
    cancel_at: trialEndUnix,
    proration_behavior: "none",
    trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
  }) satisfies Pick<
    Stripe.SubscriptionCreateParams,
    "trial_end" | "cancel_at" | "proration_behavior" | "trial_settings"
  >;

/**
 * Whether this subscription is a trial that Stripe itself will end on Hobby: it cancels at the exact
 * second the trial ends. Trials created before ENG-4035, or by hand in the Stripe Dashboard, can lack it
 * and still bill a saved card at trial end, so copy promising "no charge" is shown only when this holds.
 */
export const hasFreeTrialFallback = (
  subscription: Pick<Stripe.Subscription, "status" | "cancel_at" | "trial_end"> | null | undefined
): boolean =>
  subscription?.status === "trialing" &&
  subscription.cancel_at != null &&
  subscription.cancel_at === subscription.trial_end;
