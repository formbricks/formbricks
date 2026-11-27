import type { TFunction } from "i18next";
import {
  INVITE_TOKEN_INVALID_ERROR_CODE,
  PASSWORD_COMPROMISED_ERROR_CODE,
  SETUP_TOKEN_INVALID_ERROR_CODE,
  SIGNUP_DISABLED_ERROR_CODE,
  SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE,
} from "@formbricks/types/errors";

export type TSignupErrorPlacement =
  | { field: "email" | "password" | "setupToken"; message: string }
  | { toast: string };

/**
 * Map a failed sign-up to where the user should see it: the two field-level rejections go under the
 * input that caused them, everything else is a toast. Each stable error code exists so the server can be
 * specific without the message itself being an enumeration signal. Any other code toasts `fallbackMessage`.
 */
export const getSignupErrorPlacement = (
  errorCode: string,
  t: TFunction,
  fallbackMessage: string = errorCode
): TSignupErrorPlacement => {
  switch (errorCode) {
    case SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE:
      return { field: "email", message: t("auth.signup.company_email_required") };
    case PASSWORD_COMPROMISED_ERROR_CODE:
      return { field: "password", message: t("auth.password_compromised") };
    case SETUP_TOKEN_INVALID_ERROR_CODE:
      // ENG-7313: the fresh instance requires SETUP_TOKEN and the one entered was wrong or missing.
      return { field: "setupToken", message: t("setup.signup.setup_token_invalid") };
    case INVITE_TOKEN_INVALID_ERROR_CODE:
      // Reachable when the invite expires or is revoked between the page rendering and the form being
      // submitted. Reuses the existing invite copy rather than naming the specific reason, matching the
      // server, which returns one code for expired / revoked / wrong-address so it cannot be used to
      // probe which invites exist.
      return { toast: t("auth.invite.invite_not_found_description") };
    case SIGNUP_DISABLED_ERROR_CODE:
      // Reachable when sign-up is open as the page renders and closed before submit. A valid invite
      // still admits its holder on a closed instance, so the copy points there.
      return { toast: t("auth.signup.signup_disabled") };
    default:
      return { toast: fallbackMessage };
  }
};
