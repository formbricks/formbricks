import { NextResponse } from "next/server";
import { logger } from "@formbricks/logger";
import { getSession } from "@/modules/auth/lib/session";
import {
  BETTER_AUTH_SESSION_COOKIE_NAMES,
  getSessionTokenFromCookieHeader,
} from "@/modules/auth/lib/session-cookie";
import { revokeSessionByToken } from "@/modules/auth/lib/session-revocation";
import {
  SsoRecoveryError,
  completeSsoRecovery,
  getSsoRecoveryFailureRedirectUrl,
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

const buildFailedRecoveryResponse = async (request: Request, callbackUrl?: string) => {
  const response = NextResponse.redirect(getSsoRecoveryFailureRedirectUrl(callbackUrl));
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

export const GET = async (request: Request) => {
  const url = new URL(request.url);
  // An opaque id standing for a server-side record, not a payload (ENG-2783). The intent used to ride
  // here as a JWT, which is what let each retry nest the previous attempt's whole URL inside the next.
  const stateId = url.searchParams.get("state");

  if (!stateId) {
    return NextResponse.redirect(getSsoRecoveryFailureRedirectUrl());
  }

  try {
    const session = await getSession();
    const callbackUrl = await completeSsoRecovery({
      stateId,
      sessionUserId: session?.user.id,
      // Spared by the post-commit session sweep, so the redirect below still lands signed in.
      sessionToken: getSessionTokenFromCookieHeader(request.headers.get("cookie")) ?? undefined,
    });

    return NextResponse.redirect(callbackUrl);
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
      return NextResponse.redirect(getSsoRecoveryFailureRedirectUrl());
    }

    // Everything else — a guard that read an intent and turned it down, or an unexpected throw — keeps
    // the ENG-2557 teardown. The failure redirect wants the callback the user was originally headed
    // for, which rides on the error rather than costing a second Redis read.
    return await buildFailedRecoveryResponse(request, recoveryError?.callbackUrl);
  }
};
