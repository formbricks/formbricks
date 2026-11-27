import { describe, expect, test } from "vitest";
import { getCardRefusalReason } from "./card-refusal";

describe("getCardRefusalReason", () => {
  test.each([
    // Stripe's generic decline: test card 4000 0000 0000 0341 once it is charged.
    [{ type: "StripeCardError", code: "card_declined", decline_code: "generic_decline" }, "card_declined"],
    [{ code: "card_declined", decline_code: "do_not_honor" }, "card_declined"],
    [{ code: "card_declined" }, "card_declined"],
    [{ code: "card_declined", decline_code: "insufficient_funds" }, "card_insufficient_funds"],
    [{ code: "expired_card" }, "card_expired"],
    [{ code: "card_declined", decline_code: "expired_card" }, "card_expired"],
    // The shape Stripe.js returns from confirmCardPayment.
    [
      { type: "card_error", code: "card_declined", decline_code: "insufficient_funds" },
      "card_insufficient_funds",
    ],
    // A card that needs 3D Secure has its own message; a decline must not swallow it.
    [{ code: "card_declined", decline_code: "authentication_required" }, "card_authentication_required"],
    [{ code: "authentication_required" }, "card_authentication_required"],
    [{ code: "subscription_payment_intent_requires_action" }, "card_authentication_required"],
  ])("maps %o to %s", (error, reason) => {
    expect(getCardRefusalReason(error)).toBe(reason);
  });

  test("falls back to the decline the PaymentIntent recorded when the error names none", () => {
    // Confirming a PaymentIntent whose charge was already declined fails with a request error; the
    // decline itself is in last_payment_error.
    const error = {
      type: "invalid_request_error",
      code: "payment_intent_unexpected_state",
      payment_intent: {
        id: "pi_1",
        last_payment_error: { type: "card_error", code: "card_declined", decline_code: "insufficient_funds" },
      },
    };

    expect(getCardRefusalReason(error)).toBe("card_insufficient_funds");
  });

  test.each([
    [{ code: "resource_missing" }],
    [{ code: "payment_intent_authentication_failure" }],
    [{ code: "payment_intent_unexpected_state", payment_intent: { last_payment_error: null } }],
    [new Error("card_declined")],
    [null],
    [undefined],
    ["card_declined"],
  ])("returns null for %o", (error) => {
    expect(getCardRefusalReason(error)).toBeNull();
  });
});
