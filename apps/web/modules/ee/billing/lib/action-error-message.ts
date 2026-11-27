import { getCardRefusalReason } from "./card-refusal";

type TTranslate = (key: string) => string;

/** The billing page's message for a refusal the billing API answered with (its problem `detail`). */
export const getActionErrorMessage = (serverError: string, t: TTranslate) => {
  if (serverError === "mixed_interval_checkout_unsupported") {
    return t("workspace.settings.billing.yearly_checkout_unavailable");
  }

  if (serverError === "payment_method_required") {
    return t("workspace.settings.billing.payment_method_required");
  }

  // Trial conversion charges synchronously (payment_behavior: "error_if_incomplete"), so a card
  // needing 3DS errors out with nothing left to confirm. Say so instead of a generic failure.
  if (serverError === "card_authentication_required") {
    return t("workspace.settings.billing.payment_authentication_failed");
  }

  // The card was charged and refused: say why, so the user knows whether to change cards (ENG-2170).
  if (serverError === "card_declined") {
    return t("workspace.settings.billing.card_declined");
  }

  if (serverError === "card_insufficient_funds") {
    return t("workspace.settings.billing.card_insufficient_funds");
  }

  if (serverError === "card_expired") {
    return t("workspace.settings.billing.card_expired");
  }

  // Stripe refused the change because the customer still holds billing in another currency (ENG-3370).
  if (serverError === "billing_currency_conflict") {
    return t("workspace.settings.billing.billing_currency_conflict");
  }

  // Replacing a legacy plan charges the new subscription to a card; other saved methods can't pay it.
  if (serverError === "card_payment_method_required") {
    return t("workspace.settings.billing.card_payment_method_required");
  }

  // Stripe can't place the customer for VAT, so a paid change is refused until the billing address
  // is fixed (ENG-4033).
  if (serverError === "tax_location_required") {
    return t("workspace.settings.billing.tax_location_required");
  }

  return t("common.something_went_wrong_please_try_again");
};

/**
 * The message for an upgrade invoice the browser could not confirm: the card's refusal reason when
 * Stripe reports one, otherwise the 3D Secure message.
 */
export const getUpgradeConfirmationErrorMessage = (stripeError: unknown, t: TTranslate) => {
  const refusalReason = getCardRefusalReason(stripeError);
  return refusalReason
    ? getActionErrorMessage(refusalReason, t)
    : t("workspace.settings.billing.payment_authentication_failed");
};
