import { responses } from "@/app/lib/api/response";
import jackson from "@/modules/ee/auth/saml/lib/jackson";
import { getIsSamlSsoEnabled } from "@/modules/ee/license-check/lib/utils";
import type { OAuthReq } from "@boxyhq/saml-jackson";
import { NextRequest, NextResponse } from "next/server";

export const GET = async (req: NextRequest) => {
  const jacksonInstance = await jackson();
  if (!jacksonInstance) {
    return responses.forbiddenResponse("SAML SSO is not enabled in your Formbricks license");
  }
  const { oauthController } = jacksonInstance;
  const searchParams = Object.fromEntries(req.nextUrl.searchParams);
  const isSamlSsoEnabled = await getIsSamlSsoEnabled();

  if (!isSamlSsoEnabled) {
    return responses.forbiddenResponse("SAML SSO is not enabled in your Formbricks license");
  }

  try {
    const { redirect_url } = await oauthController.authorize(searchParams as OAuthReq);

    console.log("saml/authorize", redirect_url);

    if (!redirect_url) {
      return responses.internalServerErrorResponse("Failed to get redirect URL");
    }

    console.log("saml/authorize: reached to return redirect url", redirect_url);
    return NextResponse.redirect(redirect_url);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";

    return responses.internalServerErrorResponse(errorMessage);
  }
};
