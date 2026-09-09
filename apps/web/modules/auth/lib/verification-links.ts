import { getValidatedCallbackUrl } from "@/lib/utils/url";

const RELATIVE_URL_BASE = "http://localhost";

/**
 * The two SSO-recovery route paths.
 *
 * They live here, not in `modules/ee/sso/lib/constants.ts`, because OSS code needs them — this file
 * builds the emailed verify link, and `verification-requested/actions.ts` matches an incoming callback
 * against the completion path — and `.coderabbit.yaml` (`apps/web/modules/ee/**`) forbids OSS importing
 * from `modules/ee` outside the `license-check` gate. Route paths carry no entitlement, so the fix is
 * to own them on this side and let the EE modules import them; that direction is fine. This file is
 * also reachable from a client component (`signup/components/signup-form.tsx`), which is a second
 * reason not to pull an EE module in from here.
 */
export const SSO_RECOVERY_COMPLETION_PATH = "/api/auth/sso/recovery/complete";

/** Better Auth's recovery magic-link endpoint, mounted by `ssoRecoverySignInPlugin` under `/api/auth`. */
export const SSO_RECOVERY_SIGN_IN_PATH = "/api/auth/sso-recovery/sign-in";

/**
 * A URL's pathname, normalised the way Next resolves one before routing.
 *
 * Two callers compare an incoming callback against the paths above, and any comparison that does less
 * than the router does leaves a gap: `normalizeRepeatedSlashes` in `next/dist/shared/lib/utils.js`
 * collapses interior repeats AND backslashes, and with neither trailing-slash option set in
 * `next.config.mjs` a trailing one is dropped too. So `/api//auth/sso/recovery/complete` and
 * `…/complete/` both reach the completion route while a stricter `===` says they are something else.
 *
 * Split rather than matched with `/\/+$/`: that pattern backtracks super-linearly on a path of many
 * slashes (Sonar S8786), and this pathname comes from a caller-supplied URL.
 */
export const normalizeRoutePathname = (url: string): string | null => {
  try {
    const { pathname } = new URL(url, RELATIVE_URL_BASE);
    const segments = pathname.replaceAll("\\", "/").split("/").filter(Boolean);

    return segments.length === 0 ? "/" : `/${segments.join("/")}`;
  } catch {
    return null;
  }
};

/**
 * Lifetime of the emailed SSO-recovery magic link AND of the recovery intent behind it (ENG-2783).
 *
 * One clock for the whole flow, deliberately. The link mints the session and the intent says what to do
 * with it, so the two are halves of one operation and a gap either way is a defect: a link that
 * outlives its intent signs the user in and then lands them on "recovery failed" with recovery
 * half-done, and an intent that outlives its link sits there authorising a password-and-second-factor
 * strip long after the mail is dead. Both halves derive from this number, and
 * `getSsoRecoveryPairedTtlSeconds` keeps them paired across a resend too.
 *
 * Fifteen minutes, not the day this started as. Completing recovery clears the credential password and
 * deletes the `TwoFactor` row, which makes it the strongest capability we hand out over email — and the
 * link is a stateless JWT, so it stays replayable for its whole life. The bars for a short-lived
 * emailed credential all sit at or under an hour: NIST SP 800-63B-4 s3.1.3.2 makes an out-of-band
 * authentication invalid unless completed "within 10 minutes" (SHALL), RFC 6749 s4.1.2 RECOMMENDS at
 * most 10 minutes for an authorization code, RFC 9126 s2.2 puts a `request_uri` at "between 5 and 600
 * seconds", and OWASP WSTG 4.9 says such a link "should rarely be more than an hour". Our own password
 * reset — a strictly weaker capability, since it leaves 2FA armed — defaults to 30 minutes
 * (`PASSWORD_RESET_TOKEN_LIFETIME_MINUTES`, hard-capped at 120). Fifteen leaves room for mail delivery
 * while staying inside all of those, and unlike sign-up verification, recovery starts with the user at
 * the keyboard mid-sign-in rather than being something they come back to later.
 *
 * Scope is narrower than the name: `sendVerificationEmail` is the only consumer, and its only callers
 * are `startSsoRecovery` and the SSO-recovery branch of `resendVerificationEmailAction`. Sign-up
 * verification is Better Auth's own flow on `EMAIL_VERIFICATION_TTL_SECONDS` (1 hour) and is untouched.
 * No email copy quotes a duration, so shortening this needs no rewording — the template already offers
 * the resend link for an expired one.
 */
export const VERIFICATION_LINK_TTL_SECONDS = 60 * 15;
export const VERIFICATION_REQUEST_PURPOSES = ["email_verification", "sso_recovery"] as const;
export type TVerificationRequestPurpose = (typeof VERIFICATION_REQUEST_PURPOSES)[number];
const DEFAULT_VERIFICATION_REQUEST_PURPOSE: TVerificationRequestPurpose = "email_verification";

export const buildVerificationRequestedPath = ({
  token,
  callbackUrl,
  purpose = DEFAULT_VERIFICATION_REQUEST_PURPOSE,
}: {
  token: string;
  callbackUrl?: string | null;
  purpose?: TVerificationRequestPurpose;
}): string => {
  const verificationRequestedUrl = new URL("/auth/verification-requested", RELATIVE_URL_BASE);
  verificationRequestedUrl.searchParams.set("token", token);

  if (callbackUrl) {
    verificationRequestedUrl.searchParams.set("callbackUrl", callbackUrl);
  }

  if (purpose !== DEFAULT_VERIFICATION_REQUEST_PURPOSE) {
    verificationRequestedUrl.searchParams.set("purpose", purpose);
  }

  return `${verificationRequestedUrl.pathname}${verificationRequestedUrl.search}`;
};

/**
 * Where sign-up lands when EMAIL_VERIFICATION_DISABLED=1 — the DEFAULT for self-hosted (.env.example
 * and docker-compose both ship it) and what CI runs.
 *
 * It carries `callbackUrl` for the same reason the verification-requested path does: an invited visitor
 * whose address already has an account gets no email and nothing was created for them, so the log-in
 * link on that screen is their only way back to the invite. Without the callback it drops them at the
 * app root and the invite has to be reopened from the original mail (ENG-2091, raised by @Dhruwang and
 * @BhagyaAmarasinghe in review).
 *
 * Present for every invited visitor, never conditional on whether the account exists — that would make
 * the URL an account-existence signal (ENG-2099).
 */
export const buildSignupWithoutVerificationSuccessPath = ({
  token,
  callbackUrl,
}: {
  token: string;
  callbackUrl?: string | null;
}): string => {
  const successUrl = new URL("/auth/signup-without-verification-success", RELATIVE_URL_BASE);
  successUrl.searchParams.set("token", token);

  if (callbackUrl) {
    successUrl.searchParams.set("callbackUrl", callbackUrl);
  }

  return `${successUrl.pathname}${successUrl.search}`;
};

export const buildVerificationLinks = ({
  token,
  webAppUrl,
  callbackUrl,
  purpose = DEFAULT_VERIFICATION_REQUEST_PURPOSE,
  verificationRequestToken = token,
}: {
  token: string;
  webAppUrl: string;
  callbackUrl?: string | null;
  purpose?: TVerificationRequestPurpose;
  verificationRequestToken?: string;
}): { verificationRequestLink: string; verifyLink: string } => {
  const validatedCallbackUrl = getValidatedCallbackUrl(callbackUrl, webAppUrl);
  // The verify link now serves only SSO recovery — email verification moved to Better Auth's native
  // flow (ENG-1054), so the legacy /auth/verify page is gone. It resolves at Better Auth's
  // /sso-recovery/sign-in endpoint, which verifies the JWT, establishes the session, and redirects to
  // callbackUrl. (`purpose` still distinguishes the verification-request link below.)
  const verifyLink = new URL(SSO_RECOVERY_SIGN_IN_PATH, webAppUrl);
  verifyLink.searchParams.set("token", token);

  const verificationRequestLink = new URL("/auth/verification-requested", webAppUrl);
  verificationRequestLink.searchParams.set("token", verificationRequestToken);

  if (validatedCallbackUrl) {
    verifyLink.searchParams.set("callbackUrl", validatedCallbackUrl);
    verificationRequestLink.searchParams.set("callbackUrl", validatedCallbackUrl);
  }

  if (purpose !== DEFAULT_VERIFICATION_REQUEST_PURPOSE) {
    verificationRequestLink.searchParams.set("purpose", purpose);
  }

  return {
    verificationRequestLink: verificationRequestLink.toString(),
    verifyLink: verifyLink.toString(),
  };
};
