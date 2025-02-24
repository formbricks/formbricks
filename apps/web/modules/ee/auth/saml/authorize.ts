import { responses } from "@/app/lib/api/response";
import jackson from "@/modules/ee/auth/saml/jackson";
import { getIsSAMLSSOEnabled } from "@/modules/ee/license-check/lib/utils";
import type { OAuthReq } from "@boxyhq/saml-jackson";
import { NextRequest, NextResponse } from "next/server";

export const GET = async (req: NextRequest) => {
  const { oauthController } = await jackson();
  const searchParams = Object.fromEntries(req.nextUrl.searchParams);
  const isSAMLSSOEnabled = await getIsSAMLSSOEnabled();

  if (!isSAMLSSOEnabled) {
    return responses.badRequestResponse("SAML SSO is not enabled in your Formbricks license");
  }

  try {
    const { redirect_url } = await oauthController.authorize(searchParams as unknown as OAuthReq);

    return NextResponse.redirect(redirect_url as string);
  } catch (err) {
    const { message } = err;

    return responses.internalServerErrorResponse(message);
  }
};
