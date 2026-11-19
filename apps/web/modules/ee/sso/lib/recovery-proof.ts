import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { AUTH_SECRET } from "@/lib/constants";
import { getValidatedCallbackUrl } from "@/lib/utils/url";
import { USE_SECURE_COOKIES } from "@/modules/auth/lib/auth-cookies";
import {
  SSO_RECOVERY_COMPLETION_PATH,
  VERIFICATION_LINK_TTL_SECONDS,
  normalizeRoutePathname,
} from "@/modules/auth/lib/verification-links";

/**
 * SSO recovery proof cookie (ENG-7310): evidence that THIS browser opened the emailed recovery link.
 *
 * The completion URL is not a secret from the person who started recovery. `startSsoRecovery` hands it
 * to the starting browser (the "check your inbox" page carries it, so resend can find the intent), and
 * whoever started recovery may not own the account: anyone whose IdP identity claims the address can.
 * A session for the right user is not enough either, because a top-level navigation carries the
 * SameSite=Lax session cookie. So completion needs proof that the browser finishing it is the one that
 * opened the link sent to the account's mailbox.
 *
 * Minted where the mailbox is proven, never where recovery starts. The mail may be opened on another
 * device, and a cookie set at the start would be missing there (see ENG-2783). The browser that opens
 * the link is the one that goes on to complete, directly or through the login page for a 2FA account,
 * so this cookie travels with it.
 *
 * The value is an HMAC over the user id and the state id, so it proves the link was opened for this
 * user and this recovery. Nothing is stored server-side. A replayed link mints the same value again,
 * which is harmless: the intent itself is single use.
 */

const PROOF_DOMAIN = "formbricks.sso_recovery_proof.v1";

/**
 * `__Host-` on HTTPS, not the `__Secure-` Better Auth uses for its own cookies: `__Host-` also forbids a
 * `Domain` attribute, so a sibling subdomain cannot plant one that shadows the real proof. It requires
 * `Secure` and `Path=/`, which the options below give. Better Auth mints no `sso_recovery_proof` cookie.
 *
 * One name for every recovery: opening a second recovery link within the window replaces the first
 * proof in that browser, so the first then needs its own link opened again.
 */
export const SSO_RECOVERY_PROOF_COOKIE_NAME = `${USE_SECURE_COOKIES ? "__Host-" : ""}formbricks.sso_recovery_proof`;

export const SSO_RECOVERY_PROOF_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: USE_SECURE_COOKIES,
  // `/` and not the completion path: a deployment under a base path serves the route below that prefix,
  // and a cookie scoped to the bare path would never be sent there.
  path: "/",
  // `lax`: the emailed link arrives as a cross-site top-level navigation, and `strict` would withhold
  // the cookie on the very request chain that needs it.
  sameSite: "lax",
  // As long as the link that mints it. The 2FA path completes after a password + TOTP sign-in, well
  // inside this window.
  maxAge: VERIFICATION_LINK_TTL_SECONDS,
} as const;

const computeProof = (secret: string, userId: string, stateId: string): string =>
  createHmac("sha256", secret).update(`${PROOF_DOMAIN}\n${userId}\n${stateId}`).digest("base64url");

/** The cookie value for a link opened by `userId` for the recovery `stateId`. Never log it. */
export const createSsoRecoveryProof = (userId: string, stateId: string): string => {
  if (!AUTH_SECRET) {
    throw new Error("No auth secret set (BETTER_AUTH_SECRET or NEXTAUTH_SECRET)");
  }

  return computeProof(AUTH_SECRET, userId, stateId);
};

/**
 * Does `proof` show that this browser opened the recovery link for `userId` and `stateId`? Returns
 * false, never throws, for an absent or malformed cookie or a missing secret.
 */
export const isValidSsoRecoveryProof = (
  proof: string | null | undefined,
  userId: string,
  stateId: string
): boolean => {
  if (!proof || !AUTH_SECRET) return false;

  const expected = Buffer.from(computeProof(AUTH_SECRET, userId, stateId));
  const actual = Buffer.from(proof);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

/**
 * The state id carried by a recovery completion URL, or null when `callbackUrl` is not one. Uses the
 * same validation and path normalization as the rest of the flow, so a callback that would not be
 * followed never mints a proof.
 */
export const getSsoRecoveryStateIdFromCompletionUrl = (
  callbackUrl: string | null | undefined,
  webAppUrl: string
): string | null => {
  const validatedCallbackUrl = getValidatedCallbackUrl(callbackUrl, webAppUrl);
  if (
    !validatedCallbackUrl ||
    normalizeRoutePathname(validatedCallbackUrl) !== SSO_RECOVERY_COMPLETION_PATH
  ) {
    return null;
  }

  return new URL(validatedCallbackUrl).searchParams.get("state") || null;
};
