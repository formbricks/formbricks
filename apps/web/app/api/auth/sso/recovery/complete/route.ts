import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { logger } from "@formbricks/logger";
import { verifySsoRelinkIntent } from "@/lib/jwt";
import { deleteSessionBySessionToken } from "@/modules/auth/lib/auth-session-repository";
import { authOptions } from "@/modules/auth/lib/authOptions";
import {
  NEXT_AUTH_SESSION_COOKIE_NAMES,
  getSessionTokenFromCookieHeader,
} from "@/modules/auth/lib/session-cookie";
import { completeSsoRecovery, getSsoRecoveryFailureRedirectUrl } from "@/modules/ee/sso/lib/sso-recovery";

const clearSessionCookies = (response: NextResponse) => {
  for (const cookieName of NEXT_AUTH_SESSION_COOKIE_NAMES) {
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
    await deleteSessionBySessionToken(sessionToken);
  } catch (error) {
    logger.error(error, "Failed to delete SSO recovery session after recovery completion error");
  }

  return response;
};

export const GET = async (request: Request) => {
  const url = new URL(request.url);
  const intentToken = url.searchParams.get("intent");

  if (!intentToken) {
    return NextResponse.redirect(getSsoRecoveryFailureRedirectUrl());
  }

  try {
    const session = await getServerSession(authOptions);
    const callbackUrl = await completeSsoRecovery({
      intentToken,
      sessionUserId: session?.user.id,
    });

    return NextResponse.redirect(callbackUrl);
  } catch {
    try {
      const intent = verifySsoRelinkIntent(intentToken);
      return await buildFailedRecoveryResponse(request, intent.callbackUrl);
    } catch {
      return await buildFailedRecoveryResponse(request);
    }
  }
};
