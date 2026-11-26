/**
 * Why Stripe refused to charge a card, as the billing page names it (ENG-2170). A refusal the
 * billing API answers with carries one of these as its problem `detail`.
 */
export type TCardRefusalReason =
  | "card_authentication_required"
  | "card_declined"
  | "card_insufficient_funds"
  | "card_expired";

// Codes meaning the card needs cardholder authentication. Off-session (error_if_incomplete) nothing is
// left to confirm, so the user has to be told to use a card without 3D Secure.
const CARD_AUTHENTICATION_CODES = new Set([
  "authentication_required",
  "subscription_payment_intent_requires_action",
]);

type TStripeErrorFields = {
  code?: unknown;
  decline_code?: unknown;
  payment_intent?: { last_payment_error?: unknown } | null;
};

const classifyStripeErrorFields = (fields: unknown): TCardRefusalReason | null => {
  if (typeof fields !== "object" || fields === null) return null;
  const { code, decline_code: declineCode } = fields as TStripeErrorFields;

  if (CARD_AUTHENTICATION_CODES.has(code as string) || CARD_AUTHENTICATION_CODES.has(declineCode as string)) {
    return "card_authentication_required";
  }
  if (code === "expired_card" || declineCode === "expired_card") return "card_expired";
  if (declineCode === "insufficient_funds") return "card_insufficient_funds";
  if (code === "card_declined") return "card_declined";
  return null;
};

/**
 * Reads a card refusal from a Stripe API error (server), a Stripe.js confirm error or a PaymentIntent's
 * `last_payment_error` (browser): all carry Stripe's `code` and `decline_code`. When the error itself
 * names nothing, the PaymentIntent it carries may: a charge declined server-side leaves its reason
 * there, and confirming that PaymentIntent again fails for another reason.
 */
export const getCardRefusalReason = (error: unknown): TCardRefusalReason | null =>
  classifyStripeErrorFields(error) ??
  classifyStripeErrorFields((error as TStripeErrorFields | null)?.payment_intent?.last_payment_error);
