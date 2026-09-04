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
    // The failure redirect wants the callback the user was originally headed for. It used to be
    // recovered by decoding the intent a second time; now it rides on the error, so there is nothing
    // to re-read and no second Redis round trip. Absent when the intent could not be read at all.
    return await buildFailedRecoveryResponse(
      request,
      error instanceof SsoRecoveryError ? error.callbackUrl : undefined
    );
  }
};
