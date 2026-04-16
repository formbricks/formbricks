import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { verifySsoRelinkIntent } from "@/lib/jwt";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { completeSsoRecovery, getSsoRecoveryFailureRedirectUrl } from "@/modules/ee/sso/lib/sso-recovery";

export const GET = async (request: Request) => {
  const session = await getServerSession(authOptions);
  const url = new URL(request.url);
  const intentToken = url.searchParams.get("intent");

  if (!intentToken) {
    return NextResponse.redirect(getSsoRecoveryFailureRedirectUrl());
  }

  try {
    const callbackUrl = await completeSsoRecovery({
      intentToken,
      sessionUserId: session?.user.id,
    });

    return NextResponse.redirect(callbackUrl);
  } catch {
    try {
      const intent = verifySsoRelinkIntent(intentToken);
      return NextResponse.redirect(getSsoRecoveryFailureRedirectUrl(intent.callbackUrl));
    } catch {
      return NextResponse.redirect(getSsoRecoveryFailureRedirectUrl());
    }
  }
};
