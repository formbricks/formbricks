import { z } from "zod";
import { ZCloudBillingInterval } from "@formbricks/types/organizations";

/**
 * A Stripe object id the billing page hands back (a PaymentIntent's, a Checkout Session's). Stripe's are
 * well under 100 characters; the cap only stops a request from carrying more.
 */
export const STRIPE_OBJECT_ID_MAX = 255;

const ZStripeObjectId = z.string().min(1).max(STRIPE_OBJECT_ID_MAX);

/** The paid plans a checkout or an upgrade can target. */
const ZPaidPlan = z.enum(["pro", "scale"]);

/** `POST …/billing/checkout-sessions`: the paid plan to buy, for an organization without a subscription. */
export const ZBillingCheckoutSessionBody = z
  .object({ targetPlan: ZPaidPlan, targetInterval: ZCloudBillingInterval })
  .strict();

export type TBillingCheckoutSessionBody = z.infer<typeof ZBillingCheckoutSessionBody>;

/**
 * `POST …/billing/setup-checkout-sessions`: add a card to the existing subscription, and when `targetPlan`
 * is given, upgrade to it once the card is saved (its interval defaults to monthly, as before).
 */
export const ZBillingSetupCheckoutSessionBody = z
  .object({ targetPlan: ZPaidPlan.optional(), targetInterval: ZCloudBillingInterval.optional() })
  .strict();

export type TBillingSetupCheckoutSessionBody = z.infer<typeof ZBillingSetupCheckoutSessionBody>;

/** `GET …/billing/upgrade-charge-preview`: what an immediate upgrade to this plan would charge now. */
export const ZBillingUpgradeChargePreviewQuery = z
  .object({ targetPlan: ZPaidPlan, targetInterval: ZCloudBillingInterval })
  .strict();

export type TBillingUpgradeChargePreviewQuery = z.infer<typeof ZBillingUpgradeChargePreviewQuery>;

/** `POST …/billing/plan-changes`: Hobby is monthly only; a paid plan takes either interval. */
export const ZBillingPlanChangeBody = z.discriminatedUnion("targetPlan", [
  z.object({ targetPlan: z.literal("hobby"), targetInterval: z.literal("monthly") }).strict(),
  z.object({ targetPlan: ZPaidPlan, targetInterval: ZCloudBillingInterval }).strict(),
]);

export type TBillingPlanChangeBody = z.infer<typeof ZBillingPlanChangeBody>;

/** `POST …/billing/payment-issues`: the upgrade PaymentIntent whose authentication was abandoned. */
export const ZBillingPaymentIssueBody = z.object({ paymentIntentId: ZStripeObjectId }).strict();

export type TBillingPaymentIssueBody = z.infer<typeof ZBillingPaymentIssueBody>;

/** `POST …/billing/setup-checkout-upgrades`: the completed setup Checkout Session to finalize. */
export const ZBillingSetupCheckoutUpgradeBody = z.object({ checkoutSessionId: ZStripeObjectId }).strict();

export type TBillingSetupCheckoutUpgradeBody = z.infer<typeof ZBillingSetupCheckoutUpgradeBody>;

/** `POST …/billing/plan-waits`: the plan to wait for. */
export const ZBillingPlanWaitBody = z.object({ targetPlan: z.enum(["hobby", "pro", "scale"]) }).strict();

export type TBillingPlanWaitBody = z.infer<typeof ZBillingPlanWaitBody>;
