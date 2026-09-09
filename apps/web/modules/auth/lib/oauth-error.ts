/**
 * Classifies the `?error=<code>` an SSO callback lands on `/auth/login` with (ENG-2089).
 *
 * Every SSO button passes `/auth/login` as its `errorCallbackURL`, so a failed callback returns the
 * user to the plain login form with the reason in a query param. Before this, only
 * `account_not_linked` was read: every other failure — including a provisioning rejection from
 * `gateSsoProvisioning`, which arrives as its own reason code — rendered the same untouched form,
 * leaving the user to guess whether they had mistyped something, lost a session, or hit a policy.
 *
 * Codes collapse into four variants rather than a message each, because what the user can *do*
 * differs by variant and the exact code rarely does. Anything unrecognized still gets `generic`,
 * which is the point: Better Auth's code set moves between versions (`oauth_code_verification_failed`
 * from the original report no longer exists upstream), and a new code must degrade to "something went
 * wrong, here is what to try" rather than back to silence.
 *
 * This returns a variant rather than an i18n key so the login form keeps its `t("…")` calls as
 * literals: `scan-translations` recognizes only literal keys, and a key reached through a variable
 * reads as unused and fails `pnpm i18n:validate`.
 */
export type TOAuthErrorVariant =
  /** An existing local account owns this email. Remedy: sign in the original way, then link. */
  | "account_not_linked"
  /** The IdP authenticated the user but this instance would not provision them. Remedy: get an invite. */
  | "signup_not_allowed"
  /** The instance's SSO configuration is incomplete. Remedy: tell an admin; retrying cannot help. */
  | "misconfigured"
  /** Anything else, including transient callback failures. Remedy: try again. */
  | "generic";

const VARIANT_BY_CODE = new Map<string, TOAuthErrorVariant>([
  // Better Auth's code, and the NextAuth spelling — the cutover kept both.
  ["account_not_linked", "account_not_linked"],
  ["OAuthAccountNotLinked", "account_not_linked"],

  // What Better Auth redirects with when gateSsoProvisioning throws (the code from the ENG-2089
  // report), followed by that gate's own invite-related reject reasons.
  ["unable_to_create_user", "signup_not_allowed"],
  ["user_creation_failed", "signup_not_allowed"],
  ["missing_callback_url", "signup_not_allowed"],
  ["signin_without_invite_token", "signup_not_allowed"],
  ["invalid_invite_token", "signup_not_allowed"],
  ["invite_email_mismatch", "signup_not_allowed"],
  ["invite_token_validation_error", "signup_not_allowed"],

  // Reject reasons and callback failures that no user action can clear.
  ["missing_default_team_id", "misconfigured"],
  ["no_organization_found", "misconfigured"],
  ["insufficient_role_permissions", "misconfigured"],
  ["oauth_provider_not_found", "misconfigured"],
  ["invalid_scope", "misconfigured"],
]);

/**
 * Resolve the alert variant for an SSO `?error=` code. `null` when there is no error, which is the
 * ordinary case — the login form then renders nothing extra.
 */
export const getOAuthErrorVariant = (error?: string | null): TOAuthErrorVariant | null => {
  if (!error) return null;
  return VARIANT_BY_CODE.get(error) ?? "generic";
};
