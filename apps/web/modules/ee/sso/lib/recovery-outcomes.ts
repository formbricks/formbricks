import "server-only";
import {
  SSO_RECOVERY_LINK_NOT_OPENED_ERROR_CODE,
  SSO_RECOVERY_SECOND_FACTOR_UNAVAILABLE_ERROR_CODE,
} from "@formbricks/types/errors";
import { WEBAPP_URL } from "@/lib/constants";
import { getValidatedCallbackUrl } from "@/lib/utils/url";
import {
  SSO_RECOVERY_COMPLETION_PATH,
  SSO_RECOVERY_CONFIRM_PATH,
} from "@/modules/auth/lib/verification-links";
import { OAUTH_ACCOUNT_NOT_LINKED_ERROR, isSsoRecoveryInternalCallbackUrl } from "./constants";

export const createSsoRecoveryCompletionUrl = (stateId: string): string => {
  const completionUrl = new URL(SSO_RECOVERY_COMPLETION_PATH, WEBAPP_URL);
  completionUrl.searchParams.set("state", stateId);

  return completionUrl.toString();
};

/**
 * `unproven` is a live intent reached by a browser that never opened the emailed link (ENG-7310). It
 * says nothing against the caller's session: the session was not minted by the link, since opening the
 * link is what sets the proof. So, like `intent_unusable`, it skips the teardown. Tearing down here
 * would also let anyone holding a state id sign a victim out by sending them to the URL.
 */
export type TSsoRecoveryFailure = "intent_unusable" | "unproven" | "rejected";

/**
 * A failed recovery, sometimes carrying the callback the caller should bounce back to.
 *
 * The completion route builds its failure redirect from that callback, and it used to recover one by
 * decoding the intent JWT a second time. With the intent held server-side there is nothing in the URL
 * left to decode, so the answer travels on the error instead of costing a second Redis read.
 *
 * "Sometimes" is the load-bearing word: `callbackUrl` is set only once the caller has proven to be the
 * intent's own user, which in practice is the `user_mismatch` branch alone. Attaching it
 * earlier turned the failure redirect into an unauthenticated oracle: a caller holding a state id got
 * back the callback stored against it, while an unknown id got a bare redirect — so the response
 * distinguished "this recovery exists" from "it does not", and leaked where that user was headed. The
 * state id is 256 bits so it cannot be guessed, but it does travel in a URL and therefore in access
 * logs and history, and nothing about holding one should reveal the record behind it.
 *
 * One deliberate exception (ENG-7310): an `unproven` failure gets its own login error code, so the response
 * does say that a recovery under this id is still live. The real owner needs that message, and it is
 * all it says. The browser that started recovery knows that much already, and the id still opens nothing
 * without the proof. The callback stays withheld.
 *
 * The message stays `OAUTH_ACCOUNT_NOT_LINKED_ERROR`, unchanged from the plain `Error` this replaces.
 */
export class SsoRecoveryError extends Error {
  /**
   * `intent_unusable` means no intent came back to act on. `unproven` means one was read but this
   * browser never opened the emailed link (see {@link TSsoRecoveryFailure}). `rejected` means one WAS
   * read and a later guard turned it down.
   *
   * Named for the absence rather than for a cause, because `readSsoRecoveryIntent` cannot report a
   * cause: it answers `null` for **five** situations and its own doc says so — the record expired, a
   * completion already consumed it, the state id never named one, Redis could not be read (an outage,
   * or the cache facade's timeout), or the stored value failed validation. An earlier version of this
   * comment claimed two, which is the sort of drift the next reader inherits as fact. A sixth reaches
   * here from `claimSsoRecoveryIntent` (ENG-7395): the intent is live but another Link or Cancel holds it,
   * which is an ordinary double click and must not tear down the winner's session either.
   *
   * All five skip the teardown, deliberately. The route's failure response revokes the session token
   * off the CALLER'S OWN cookie (`route.ts` → `buildFailedRecoveryResponse`), so skipping it can never
   * preserve anything the caller did not already hold — there is no fail-open to be had here. What
   * fails closed is the account link itself: `completeSsoRecovery` throws before any write, on every
   * one of the five. So the teardown is session hygiene for a recovery that was *refused*, not a
   * safety net for one that could not be read.
   *
   * And the two ordinary members of the five decide it. The emailed link is replayable for its window
   * by design (`better-auth-recovery-signin.ts`), so a second open — already consumed — must not sign
   * the user in and then immediately sign them out claiming the link failed, after it had in fact
   * succeeded. A transient Redis blip behaves the same way on purpose: the user keeps the session the
   * link legitimately minted and re-opening the still-valid link just works, where a teardown would
   * log them out mid-flow to protect nothing.
   */
  readonly failure: TSsoRecoveryFailure;
  readonly callbackUrl?: string;

  constructor(failure: TSsoRecoveryFailure, callbackUrl?: string) {
    super(OAUTH_ACCOUNT_NOT_LINKED_ERROR);
    this.name = "SsoRecoveryError";
    this.failure = failure;
    this.callbackUrl = callbackUrl;
  }
}

/**
 * Where to send the user once recovery completes — never back into recovery itself (ENG-2783).
 *
 * See `isSsoRecoveryInternalCallbackUrl` for why a recovery URL reaches this point at all, and why the
 * check cannot live in `getValidatedCallbackUrl`.
 */
export const resolveRecoveryCallbackUrl = (callbackUrl: string): string => {
  const validatedCallbackUrl = getValidatedCallbackUrl(callbackUrl, WEBAPP_URL);

  if (!validatedCallbackUrl || isSsoRecoveryInternalCallbackUrl(validatedCallbackUrl)) {
    return WEBAPP_URL;
  }

  return validatedCallbackUrl;
};

export const buildSsoRecoveryLoginUrl = (callbackUrl: string | undefined, error?: string): string => {
  const loginUrl = new URL("/auth/login", WEBAPP_URL);
  if (error) {
    loginUrl.searchParams.set("error", error);
  }

  const validatedCallbackUrl = getValidatedCallbackUrl(callbackUrl, WEBAPP_URL);
  if (validatedCallbackUrl) {
    loginUrl.searchParams.set("callbackUrl", validatedCallbackUrl);
  }

  return loginUrl.toString();
};

export const getSsoRecoveryFailureRedirectUrl = (callbackUrl?: string): string =>
  buildSsoRecoveryLoginUrl(callbackUrl, OAUTH_ACCOUNT_NOT_LINKED_ERROR);

/**
 * Where the recovery link sends a user whose second factor it cannot check (ENG-7266): the login page,
 * carrying the completion URL as `callbackUrl`. They sign in with password + TOTP (or a linked SSO
 * provider), the login form follows the callback, and `completeSsoRecovery` links the new identity once
 * the session user matches the intent.
 */
export const getSsoRecoverySecondFactorRedirectUrl = (callbackUrl?: string): string =>
  buildSsoRecoveryLoginUrl(callbackUrl);

/**
 * The same redirect where the login page cannot produce the second factor: the instance has credential
 * sign-in switched off (`EMAIL_AUTH_DISABLED=1`), so the form that would ask for password + TOTP is not
 * rendered, and the identity that started recovery is unlinked by definition. A provider already linked
 * to the account still gets the user through, which is why the copy names that before the administrator;
 * landing there without a word is the silent loop this code exists to end (ENG-7266).
 */
export const getSsoRecoverySecondFactorUnavailableRedirectUrl = (callbackUrl?: string): string =>
  buildSsoRecoveryLoginUrl(callbackUrl, SSO_RECOVERY_SECOND_FACTOR_UNAVAILABLE_ERROR_CODE);

/**
 * Where a completion goes when this browser never opened the emailed link (ENG-7310). Never carries a
 * callback: the caller has not proven anything, and the intent's callback would tell them where the
 * account holder was headed.
 */
export const getSsoRecoveryLinkNotOpenedRedirectUrl = (): string =>
  buildSsoRecoveryLoginUrl(undefined, SSO_RECOVERY_LINK_NOT_OPENED_ERROR_CODE);

/** Where a refused recovery sends the browser, and whether the completion route revokes its session. */
export type TSsoRecoveryRefusal = { redirectUrl: string; revokesSession: boolean };

/**
 * Every way a recovery can be refused, in one place, so the confirmation page and the completion route
 * cannot disagree about where a refusal goes or whether it costs the caller their session.
 *
 * `intent_unusable` and `unproven` leave the session alone. The first covers five situations the store
 * cannot tell apart (expired, already consumed, never issued, Redis unreadable, malformed) plus a live
 * intent another Link or Cancel is acting on, and the ordinary ones must not be punished: the emailed link
 * is replayable for its window, so a second open that finds the intent consumed would otherwise sign the
 * user out right after linking succeeded. The second is a browser that never opened the emailed link, so
 * its session was not minted by the link, and revoking it would let anyone holding a state id sign the
 * account holder out. Skipping the teardown is safe because it only revokes the caller's own token; the
 * link itself already failed closed before any write.
 *
 * `rejected`, a guard that read an intent and turned it down, and any unexpected throw keep the ENG-2557
 * teardown. Only the completion route can apply it: the page is a server component and cannot clear
 * cookies, so a refusal there leaves the session the emailed link created, which belongs to whoever proved
 * the mailbox.
 */
const SSO_RECOVERY_REFUSALS: Record<
  TSsoRecoveryFailure | "unexpected",
  (callbackUrl?: string) => TSsoRecoveryRefusal
> = {
  intent_unusable: () => ({ redirectUrl: getSsoRecoveryFailureRedirectUrl(), revokesSession: false }),
  unproven: () => ({ redirectUrl: getSsoRecoveryLinkNotOpenedRedirectUrl(), revokesSession: false }),
  rejected: (callbackUrl) => ({
    redirectUrl: getSsoRecoveryFailureRedirectUrl(callbackUrl),
    revokesSession: true,
  }),
  unexpected: () => ({ redirectUrl: getSsoRecoveryFailureRedirectUrl(), revokesSession: true }),
};

export const getSsoRecoveryRefusal = (error: unknown): TSsoRecoveryRefusal =>
  error instanceof SsoRecoveryError
    ? SSO_RECOVERY_REFUSALS[error.failure](error.callbackUrl)
    : SSO_RECOVERY_REFUSALS.unexpected();

/** The confirmation page for a recovery (ENG-7395). */
export const getSsoRecoveryConfirmUrl = (stateId: string): string => {
  const confirmUrl = new URL(SSO_RECOVERY_CONFIRM_PATH, WEBAPP_URL);
  confirmUrl.searchParams.set("state", stateId);

  return confirmUrl.toString();
};
