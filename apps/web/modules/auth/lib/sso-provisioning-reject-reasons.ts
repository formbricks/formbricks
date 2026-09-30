import { SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE } from "@formbricks/types/errors";

/**
 * Every reason `gateSsoProvisioning` can refuse an SSO sign-up with (ENG-2882).
 *
 * These codes leave the server: the gate's reject throws an `APIError` carrying one as its `code`,
 * and Better Auth's OAuth callback turns that into `<errorCallbackURL>?error=<code>`. Three unrelated
 * places then have to recognize the same closed set — the login form's alert variants
 * (`oauth-error.ts`), the callback-outcome log's reason allow-list (`better-auth-observability.ts`),
 * and the gate itself — so the set lives here rather than as three hand-maintained copies that drift.
 *
 * It had drifted already, which is why this exists: ENG-2089 added all nine to the login form's map,
 * while the observability allow-list still knew only the pre-fix `unable_to_create_user`, so every
 * rejection logged as `other` and the question "are these rejections correct?" had no data behind it.
 *
 * Deliberately dependency-free (one string constant aside): the login form is a client component, and
 * `sso-provisioning.ts` is `server-only` and pulls in Prisma, licence checks and the invite service.
 *
 * It lives in OSS `modules/auth`, not beside the gate in `modules/ee`, although the gate is the only
 * thing that produces these codes. `modules/ee` is under a separate licence, and the consumers here
 * are OSS — the login form most of all — so an OSS file importing the set from there would put
 * EE-licensed source on the path of every sign-in page render. The direction that holds is the one
 * `better-auth-hooks.ts` already uses for `credential-signup-backstop`: EE reaches into OSS, never
 * the reverse. What travels is a wire contract — the `?error=` codes — not an enterprise feature.
 *
 * Keep this list and `TSsoProvisioningRejectReason` in step by adding reasons HERE first — both
 * consumers key a `Record` on the union, so a new reason fails the build until it is classified.
 */
export const SSO_PROVISIONING_REJECT_REASONS = [
  /** Formbricks Cloud's personal/free/disposable email-domain block. Rescued to `/auth/signup`. */
  SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE,
  /** The callback carried no URL, so no invite token could be read off it. */
  "missing_callback_url",
  /** An explicit sign-in (`source=signin`) by someone with no account and no invite token. */
  "signin_without_invite_token",
  /** The invite token is present but expired, already used, or unknown. */
  "invalid_invite_token",
  /** The invite is valid but was issued to a different address than the IdP asserted. */
  "invite_email_mismatch",
  /** The invite lookup itself failed — an unparseable callback URL, or a verification error. */
  "invite_token_validation_error",
  /** Operator misconfiguration: `SKIP_INVITE_FOR_SSO` is set without a `DEFAULT_TEAM_ID`. */
  "missing_default_team_id",
  /** Operator misconfiguration: single-org instance with no organization to assign the user to. */
  "no_organization_found",
  /** Operator misconfiguration: access control is unlicensed and no callback URL was supplied. */
  "insufficient_role_permissions",
] as const;

export type TSsoProvisioningRejectReason = (typeof SSO_PROVISIONING_REJECT_REASONS)[number];
