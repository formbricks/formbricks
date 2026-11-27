import { describe, expect, test } from "vitest";
import { getActionErrorMessage, getUpgradeConfirmationErrorMessage } from "./action-error-message";

const t = (key: string) => key;

describe("getActionErrorMessage", () => {
  test.each([
    ["card_declined", "workspace.settings.billing.card_declined"],
    ["card_insufficient_funds", "workspace.settings.billing.card_insufficient_funds"],
    ["card_expired", "workspace.settings.billing.card_expired"],
    ["card_authentication_required", "workspace.settings.billing.payment_authentication_failed"],
    ["payment_method_required", "workspace.settings.billing.payment_method_required"],
    ["tax_location_required", "workspace.settings.billing.tax_location_required"],
    ["mixed_interval_checkout_unsupported", "workspace.settings.billing.yearly_checkout_unavailable"],
    ["billing_currency_conflict", "workspace.settings.billing.billing_currency_conflict"],
    ["card_payment_method_required", "workspace.settings.billing.card_payment_method_required"],
  ])("translates the refusal %s", (reason, key) => {
    expect(getActionErrorMessage(reason, t)).toBe(key);
  });

  test("falls back to the generic message for an unknown reason", () => {
    expect(getActionErrorMessage("", t)).toBe("common.something_went_wrong_please_try_again");
    expect(getActionErrorMessage("stripe is down", t)).toBe("common.something_went_wrong_please_try_again");
  });
});

describe("getUpgradeConfirmationErrorMessage", () => {
  // stripe.confirmCardPayment answers a declined card with a card error, not an authentication failure.
  test.each([
    [{ type: "card_error", code: "card_declined", decline_code: "generic_decline" }, "card_declined"],
    [
      { type: "card_error", code: "card_declined", decline_code: "insufficient_funds" },
      "card_insufficient_funds",
    ],
    [{ type: "card_error", code: "expired_card" }, "card_expired"],
    [
      {
        type: "invalid_request_error",
        code: "payment_intent_unexpected_state",
        payment_intent: { last_payment_error: { code: "card_declined", decline_code: "generic_decline" } },
      },
      "card_declined",
    ],
  ])("names the decline in %o", (stripeError, reason) => {
    expect(getUpgradeConfirmationErrorMessage(stripeError, t)).toBe(`workspace.settings.billing.${reason}`);
  });

  test.each([
    [{ type: "invalid_request_error", code: "payment_intent_authentication_failure" }],
    [{ type: "card_error", code: "card_declined", decline_code: "authentication_required" }],
    [null],
  ])("keeps the authentication message for %o", (stripeError) => {
    expect(getUpgradeConfirmationErrorMessage(stripeError, t)).toBe(
      "workspace.settings.billing.payment_authentication_failed"
    );
  });
});
