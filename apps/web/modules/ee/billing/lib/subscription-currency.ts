import Stripe from "stripe";
import { logger } from "@formbricks/logger";
import { OperationNotAllowedError } from "@formbricks/types/errors";

// Sentinel message of the expected error raised when a billing change would mix currencies on the
// Stripe customer and can't be done automatically. The billing UI maps it to a localized message.
export const BILLING_CURRENCY_CONFLICT_ERROR_CODE = "billing_currency_conflict";

/**
 * Whether an existing subscription bills in a different currency than the catalog prices it would
 * move to. Legacy plans are €0 EUR subscriptions while the catalog is USD-only; Stripe can neither
 * swap a USD price onto a EUR subscription nor run a second currency beside it, so such a move has
 * to replace the subscription instead of changing its items (ENG-3370). A missing currency is
 * treated as matching, keeping the item-swap path for anything that does not say otherwise.
 */
export const isSubscriptionCurrencyMismatch = (
  subscriptionCurrency: string | null | undefined,
  catalogCurrency: string
): boolean =>
  subscriptionCurrency != null && subscriptionCurrency.toLowerCase() !== catalogCurrency.toLowerCase();

/**
 * Whether every item of a subscription is explicitly priced at 0 — the €0 legacy plans. Only such a
 * subscription may be canceled without proration or a final invoice when it is replaced: anything
 * else would forfeit time or usage the customer paid for. A price without a flat unit amount (tiered,
 * or custom) is not known to be free, so it does not count.
 */
export const isFreeSubscription = (
  items: ReadonlyArray<{ price: { unit_amount: number | null } }>
): boolean => items.length > 0 && items.every((item) => item.price.unit_amount === 0);

// Stripe reports a currency clash only in prose (no error code): either a price that cannot be charged
// in the subscription's/invoice's currency, or a customer that still holds an object (subscription,
// discount, invoice item, checkout session…) in another currency.
const STRIPE_CURRENCY_CONFLICT_MESSAGE =
  /cannot combine currencies|doesn't match the (?:expected|invoice's) currency/i;

/**
 * Maps Stripe's currency-clash rejection to an expected OperationNotAllowedError, so the action
 * returns a specific message instead of the generic server error and a Sentry fault. Any other error
 * is returned unchanged for the caller to rethrow.
 */
export const toBillingCurrencyConflictError = (error: unknown): unknown => {
  if (
    error instanceof Stripe.errors.StripeInvalidRequestError &&
    STRIPE_CURRENCY_CONFLICT_MESSAGE.test(error.message)
  ) {
    // Expected for the user, but still worth seeing: it names a Stripe object support must clean up.
    logger.warn({ error }, "Stripe refused a billing change that would mix currencies on the customer");
    return new OperationNotAllowedError(BILLING_CURRENCY_CONFLICT_ERROR_CODE);
  }

  return error;
};

/**
 * Whether Stripe rejected an update because the subscription is already canceled. Replacing a legacy
 * subscription cancels it, so a late or repeated attempt to attach a card to it hits this.
 */
export const isCanceledSubscriptionUpdateError = (error: unknown): boolean =>
  error instanceof Stripe.errors.StripeInvalidRequestError &&
  error.code === "invalid_canceled_subscription_fields";
