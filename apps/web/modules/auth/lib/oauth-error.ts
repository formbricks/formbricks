import { SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE } from "@formbricks/types/errors";
import type { TSsoProvisioningRejectReason } from "./sso-provisioning-reject-reasons";

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

/**
 * Every provisioning reject reason, classified. Keyed on the union rather than listed as loose
 * strings (ENG-2882), so adding a reason to `SSO_PROVISIONING_REJECT_REASONS` fails the build here
 * until someone decides what the user should be told — the alternative is a new reason silently
 * falling through to `generic` ("try again") when the truth may be that retrying cannot ever work.
 */
const VARIANT_BY_REJECT_REASON: Record<TSsoProvisioningRejectReason, TOAuthErrorVariant> = {
  // Cloud's personal-email block. Normally rescued to `/auth/signup`, which toasts a message naming
  // the actual requirement; this is the fallback for when that rewrite does not happen.
  [SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE]: "signup_not_allowed",
  missing_callback_url: "signup_not_allowed",
  signin_without_invite_token: "signup_not_allowed",
  invalid_invite_token: "signup_not_allowed",
  invite_email_mismatch: "signup_not_allowed",
  invite_token_validation_error: "signup_not_allowed",

  // Operator misconfiguration: the user did nothing wrong and retrying cannot clear it.
  missing_default_team_id: "misconfigured",
  no_organization_found: "misconfigured",
  insufficient_role_permissions: "misconfigured",
};

const VARIANT_BY_CODE = new Map<string, TOAuthErrorVariant>([
  // Better Auth's code, and the NextAuth spelling — the cutover kept both.
  ["account_not_linked", "account_not_linked"],
  ["OAuthAccountNotLinked", "account_not_linked"],

  // What Better Auth redirects with when the gate rejects. `unable_to_create_user` is what 5.4.x
  // emitted for the whole class before the gate threw a reason-carrying APIError (ENG-2537).
  ["unable_to_create_user", "signup_not_allowed"],
  ["user_creation_failed", "signup_not_allowed"],

  // Callback failures that no user action can clear.
  ["oauth_provider_not_found", "misconfigured"],
  ["invalid_scope", "misconfigured"],

  ...Object.entries(VARIANT_BY_REJECT_REASON),
]);

/**
 * Resolve the alert variant for an SSO `?error=` code. `null` when there is no error, which is the
 * ordinary case — the login form then renders nothing extra.
 */
export const getOAuthErrorVariant = (error?: string | null): TOAuthErrorVariant | null => {
  if (!error) return null;
  return VARIANT_BY_CODE.get(error) ?? "generic";
};
