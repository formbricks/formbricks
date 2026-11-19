import { NextResponse } from "next/server";
import { logger } from "@formbricks/logger";
import { WEBAPP_URL } from "@/lib/constants";
import { withAuthRequestBodyLimit } from "@/modules/auth/lib/auth-request-body-limit";
import { getSession } from "@/modules/auth/lib/session";
import {
  BETTER_AUTH_SESSION_COOKIE_NAMES,
  getCookieValueFromHeader,
  getSessionTokenFromCookieHeader,
} from "@/modules/auth/lib/session-cookie";
import { revokeSessionByToken } from "@/modules/auth/lib/session-revocation";
import {
  SSO_RECOVERY_PROOF_COOKIE_NAME,
  SSO_RECOVERY_PROOF_COOKIE_OPTIONS,
} from "@/modules/ee/sso/lib/recovery-proof";
import {
  SsoRecoveryError,
  cancelSsoRecovery,
  completeSsoRecovery,
  getSsoRecoveryConfirmUrl,
  getSsoRecoveryFailureRedirectUrl,
  getSsoRecoveryRefusalRedirectUrl,
} from "@/modules/ee/sso/lib/sso-recovery";

const clearSessionCookies = (response: NextResponse) => {
  for (const cookieName of BETTER_AUTH_SESSION_COOKIE_NAMES) {
    response.cookies.set({
      name: cookieName,
      value: "",
      expires: new Date(0),
      path: "/",
      secure: cookieName.startsWith("__Secure-"),
    });
  }
};

const buildFailedRecoveryResponse = async (request: Request, error: unknown, status: number) => {
  const response = NextResponse.redirect(getSsoRecoveryRefusalRedirectUrl(error), status);
  clearSessionCookies(response);

  const sessionToken = getSessionTokenFromCookieHeader(request.headers.get("cookie"));
  if (!sessionToken) {
    return response;
  }

  try {
    // Through the two-store revocation, not a raw Prisma delete: sessions live in Redis too, and a
    // DB-only delete would leave this one resolvable by `getSession` until its TTL (ENG-2557).
    await revokeSessionByToken(sessionToken);
  } catch (error) {
    logger.error(error, "Failed to delete SSO recovery session after recovery completion error");
  }

  return response;
};

/**
 * GET never links (ENG-7395). It is what the emailed link redirects to, and a GET can be issued by a
 * mail scanner, a link preview or a page the account holder never meant to act on. It only forwards to
 * the confirmation page, which names the provider and POSTs back here when the account holder chooses
 * to link. The completion URL keeps its shape, so links already sent and the 2FA path (the login page
 * follows this URL as its callback) both land on the page.
 */
const getHandler = async (request: Request) => {
  // An opaque id standing for a server-side record, not a payload (ENG-2783). The intent used to ride
  // here as a JWT, which is what let each retry nest the previous attempt's whole URL inside the next.
  const stateId = new URL(request.url).searchParams.get("state");

  if (!stateId) {
    return NextResponse.redirect(getSsoRecoveryFailureRedirectUrl());
  }

  return NextResponse.redirect(getSsoRecoveryConfirmUrl(stateId));
};

/**
 * Only a deliberate, same-origin form submission acts (ENG-7395).
 *
 * Session and proof cookies are SameSite=Lax, so a cross-site POST arrives without them and is refused
 * anyway; `Sec-Fetch-Site` says so outright. Same-origin is not enough on its own, though: a script on
 * this origin (a self-hosted link survey's custom head script, say) could `fetch()` the POST without the
 * account holder ever seeing the page. So when the browser sends Fetch Metadata at all, the request must
 * also be a top-level navigation the user activated: `Sec-Fetch-Mode: navigate`, `Sec-Fetch-Dest:
 * document`, `Sec-Fetch-User: ?1`. A `fetch()` sends `cors`/`empty` and a scripted `form.submit()` sends
 * no `Sec-Fetch-User`. A browser without Fetch Metadata still has the Lax refusal.
 */
const isDeliberateSubmission = (request: Request): boolean => {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === null) return true;

  return (
    fetchSite === "same-origin" &&
    request.headers.get("sec-fetch-mode") === "navigate" &&
    request.headers.get("sec-fetch-dest") === "document" &&
    request.headers.get("sec-fetch-user") === "?1"
  );
};

type TSubmission = { stateId: string; action: "link" | "cancel" };

const readSubmission = async (request: Request): Promise<TSubmission | null> => {
  try {
    const form = await request.formData();
    const stateId = form.get("state");
    if (typeof stateId !== "string" || stateId.length === 0) return null;

    return { stateId, action: form.get("action") === "cancel" ? "cancel" : "link" };
  } catch (error) {
    // `formData()` rejects with a TypeError for a body that is not form data; that is a bad request,
    // not a fault. Anything else is unexpected and propagates.
    if (error instanceof TypeError) return null;
    throw error;
  }
};

/** The proof has done its job (the recovery was linked or cancelled), so nothing reads it again. */
const clearProofCookie = (response: NextResponse) => {
  response.cookies.set({
    name: SSO_RECOVERY_PROOF_COOKIE_NAME,
    value: "",
    ...SSO_RECOVERY_PROOF_COOKIE_OPTIONS,
    maxAge: 0,
  });
};

/**
 * The response to a refused link or cancel. Redirects go through `getSsoRecoveryRefusalRedirectUrl`,
 * which the confirmation page uses too, so both send a refusal to the same place.
 *
 * `intent_unusable` and `unproven` leave the session alone. The first covers five situations the store
 * cannot tell apart (expired, already consumed, never issued, Redis unreadable, malformed), and the
 * ordinary ones must not be punished: the emailed link is replayable for its window, so a second open
 * that finds the intent consumed would otherwise sign the user out right after linking succeeded. The
 * second is a browser that never opened the emailed link, so its session was not minted by the link,
 * and tearing it down would let anyone holding a state id sign the account holder out. Skipping the
 * teardown is safe because it only revokes the token off the caller's own cookie; the link itself
 * already failed closed before any write.
 *
 * Everything else, a guard that read an intent and turned it down or an unexpected throw, keeps the
 * ENG-2557 teardown.
 */
const buildRefusalResponse = async (request: Request, error: unknown) => {
  if (!(error instanceof SsoRecoveryError)) {
    logger.error(error, "Unexpected error completing SSO recovery");
  }

  const failure = error instanceof SsoRecoveryError ? error.failure : null;
  if (failure === "intent_unusable" || failure === "unproven") {
    return NextResponse.redirect(getSsoRecoveryRefusalRedirectUrl(error), 303);
  }

  return await buildFailedRecoveryResponse(request, error, 303);
};

const postHandler = async (request: Request) => {
  if (!isDeliberateSubmission(request)) {
    return NextResponse.redirect(getSsoRecoveryFailureRedirectUrl(), 303);
  }

  const submission = await readSubmission(request);

  if (!submission) {
    return NextResponse.redirect(getSsoRecoveryFailureRedirectUrl(), 303);
  }

  const cookieHeader = request.headers.get("cookie");
  const recoveryProof =
    (cookieHeader && getCookieValueFromHeader(cookieHeader, SSO_RECOVERY_PROOF_COOKIE_NAME)) || undefined;

  try {
    const session = await getSession();

    if (submission.action === "cancel") {
      await cancelSsoRecovery({
        stateId: submission.stateId,
        recoveryProof,
        sessionUserId: session?.user.id,
      });
      const response = NextResponse.redirect(WEBAPP_URL, 303);
      clearProofCookie(response);
      return response;
    }

    const callbackUrl = await completeSsoRecovery({
      stateId: submission.stateId,
      // Set when this browser opened the emailed link (ENG-7310).
      recoveryProof,
      sessionUserId: session?.user.id,
      // Spared by the post-commit session sweep, so the redirect below still lands signed in.
      sessionToken: getSessionTokenFromCookieHeader(cookieHeader) ?? undefined,
    });

    // 303, not the default 307: a 307 would replay this POST against the callback.
    const response = NextResponse.redirect(callbackUrl, 303);
    clearProofCookie(response);
    return response;
  } catch (error) {
    return await buildRefusalResponse(request, error);
  }
};

export const GET = withAuthRequestBodyLimit(getHandler);
export const POST = withAuthRequestBodyLimit(postHandler);
