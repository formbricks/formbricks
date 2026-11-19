import { NextResponse } from "next/server";
import { logger } from "@formbricks/logger";
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
  completeSsoRecovery,
  getSsoRecoveryConfirmUrl,
  getSsoRecoveryFailureRedirectUrl,
  getSsoRecoveryLinkNotOpenedRedirectUrl,
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

const buildFailedRecoveryResponse = async (
  request: Request,
  callbackUrl: string | undefined,
  status: number
) => {
  const response = NextResponse.redirect(getSsoRecoveryFailureRedirectUrl(callbackUrl), status);
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
 * Only a same-origin submission links. Session and proof cookies are SameSite=Lax, so a cross-site POST
 * arrives without them and is refused anyway; checking `Sec-Fetch-Site` says so outright rather than
 * leaning on cookie attributes alone. Browsers that send no such header still have the Lax refusal.
 */
const isCrossSiteSubmission = (request: Request): boolean => {
  const fetchSite = request.headers.get("sec-fetch-site");
  return fetchSite !== null && fetchSite !== "same-origin";
};

const readStateId = async (request: Request): Promise<string | null> => {
  try {
    const stateId = (await request.formData()).get("state");
    return typeof stateId === "string" && stateId.length > 0 ? stateId : null;
  } catch {
    return null;
  }
};

const postHandler = async (request: Request) => {
  if (isCrossSiteSubmission(request)) {
    return NextResponse.redirect(getSsoRecoveryFailureRedirectUrl(), 303);
  }

  const stateId = await readStateId(request);

  if (!stateId) {
    return NextResponse.redirect(getSsoRecoveryFailureRedirectUrl(), 303);
  }

  const cookieHeader = request.headers.get("cookie");

  try {
    const session = await getSession();
    const callbackUrl = await completeSsoRecovery({
      stateId,
      // Set when this browser opened the emailed link (ENG-7310).
      recoveryProof:
        (cookieHeader && getCookieValueFromHeader(cookieHeader, SSO_RECOVERY_PROOF_COOKIE_NAME)) || undefined,
      sessionUserId: session?.user.id,
      // Spared by the post-commit session sweep, so the redirect below still lands signed in.
      sessionToken: getSessionTokenFromCookieHeader(cookieHeader) ?? undefined,
    });

    // 303, not the default 307: a 307 would replay this POST against the callback.
    const response = NextResponse.redirect(callbackUrl, 303);
    // The proof has done its job and the intent is spent; nothing reads the cookie again.
    response.cookies.set({
      name: SSO_RECOVERY_PROOF_COOKIE_NAME,
      value: "",
      ...SSO_RECOVERY_PROOF_COOKIE_OPTIONS,
      maxAge: 0,
    });
    return response;
  } catch (error) {
    const recoveryError = error instanceof SsoRecoveryError ? error : null;

    // No usable intent came back, and that is not evidence of a session that should not exist. Five
    // situations land here and the store cannot tell them apart (see `SsoRecoveryError.failure`):
    // expired, already consumed, never issued, Redis unreadable, or a record that failed validation.
    //
    // Tearing the session down would punish the ordinary ones. A link replayable for its whole window
    // by design gets opened twice; the sign-in endpoint establishes the session, and this route would
    // then revoke it and report that the linking failed, after it had already succeeded on the first
    // open. Skipping the teardown is safe for the rest too, because it only revokes the token off this
    // caller's own cookie — the account link has already failed closed inside `completeSsoRecovery`,
    // which threw before writing anything. So leave the session alone and just redirect.
    if (recoveryError?.failure === "intent_unusable") {
      return NextResponse.redirect(getSsoRecoveryFailureRedirectUrl(), 303);
    }

    // A live intent reached by a browser that never opened the emailed link (ENG-7310) is the same: that
    // session was not minted by the link. Tearing it down would also let anyone holding a state id sign
    // the account holder out by sending their browser here. The login page then says to open the
    // emailed link, and to ignore it when the reader did not start a sign-in.
    if (recoveryError?.failure === "unproven") {
      return NextResponse.redirect(getSsoRecoveryLinkNotOpenedRedirectUrl(), 303);
    }

    // Everything else — a guard that read an intent and turned it down, or an unexpected throw — keeps
    // the ENG-2557 teardown. The failure redirect wants the callback the user was originally headed
    // for, which rides on the error rather than costing a second Redis read.
    return await buildFailedRecoveryResponse(request, recoveryError?.callbackUrl, 303);
  }
};

export const GET = withAuthRequestBodyLimit(getHandler);
export const POST = withAuthRequestBodyLimit(postHandler);
