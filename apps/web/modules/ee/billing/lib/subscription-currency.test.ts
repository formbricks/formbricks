import Stripe from "stripe";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  isCanceledSubscriptionUpdateError,
  isFreeSubscription,
  isSubscriptionCurrencyMismatch,
  toBillingCurrencyConflictError,
} from "./subscription-currency";

const mocks = vi.hoisted(() => ({ loggerWarn: vi.fn() }));

vi.mock("@formbricks/logger", () => ({ logger: { warn: mocks.loggerWarn } }));

const stripeInvalidRequest = (message: string, code?: string) =>
  new Stripe.errors.StripeInvalidRequestError({ type: "invalid_request_error", message, code });

describe("isSubscriptionCurrencyMismatch", () => {
  test("flags a EUR subscription moving onto USD catalog prices", () => {
    expect(isSubscriptionCurrencyMismatch("eur", "usd")).toBe(true);
  });

  test("treats the same currency as a match regardless of case", () => {
    expect(isSubscriptionCurrencyMismatch("USD", "usd")).toBe(false);
  });

  test("treats an unknown subscription currency as a match", () => {
    expect(isSubscriptionCurrencyMismatch(null, "usd")).toBe(false);
    expect(isSubscriptionCurrencyMismatch(undefined, "usd")).toBe(false);
  });
});

describe("isFreeSubscription", () => {
  test("is true only when every item is explicitly priced at 0", () => {
    expect(isFreeSubscription([{ price: { unit_amount: 0 } }, { price: { unit_amount: 0 } }])).toBe(true);
    expect(isFreeSubscription([{ price: { unit_amount: 0 } }, { price: { unit_amount: 2900 } }])).toBe(false);
  });

  test("does not treat a price without a flat amount (tiered/custom) or no items as free", () => {
    expect(isFreeSubscription([{ price: { unit_amount: null } }])).toBe(false);
    expect(isFreeSubscription([])).toBe(false);
  });
});

describe("toBillingCurrencyConflictError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test.each([
    "The price specified only supports `usd`. This doesn't match the expected currency: `eur`.",
    "The price specified only supports `usd`. This doesn't match the invoice's currency: `eur`.",
    "You cannot combine currencies on a single customer. This customer has an active subscription with currency eur.",
  ])("maps Stripe's currency clash to an expected error and logs it: %s", (message) => {
    expect(toBillingCurrencyConflictError(stripeInvalidRequest(message))).toMatchObject({
      name: "OperationNotAllowedError",
      message: "billing_currency_conflict",
    });
    expect(mocks.loggerWarn).toHaveBeenCalledTimes(1);
  });

  test("leaves other Stripe invalid-request errors unchanged", () => {
    const error = stripeInvalidRequest("No such price: 'price_missing'");
    expect(toBillingCurrencyConflictError(error)).toBe(error);
    expect(mocks.loggerWarn).not.toHaveBeenCalled();
  });

  test("leaves a non-Stripe error with the same wording unchanged", () => {
    const error = new Error("You cannot combine currencies on a single customer.");
    expect(toBillingCurrencyConflictError(error)).toBe(error);
  });
});

describe("isCanceledSubscriptionUpdateError", () => {
  test("matches only Stripe's canceled-subscription update rejection", () => {
    expect(
      isCanceledSubscriptionUpdateError(
        stripeInvalidRequest(
          "A canceled subscription can only update its cancellation_details and metadata.",
          "invalid_canceled_subscription_fields"
        )
      )
    ).toBe(true);
    expect(
      isCanceledSubscriptionUpdateError(stripeInvalidRequest("No such subscription", "resource_missing"))
    ).toBe(false);
    expect(isCanceledSubscriptionUpdateError(new Error("invalid_canceled_subscription_fields"))).toBe(false);
  });
});
