import jackson from "@/modules/ee/auth/saml/jackson";
import { getIsSAMLSSOEnabled } from "@/modules/ee/license-check/lib/utils";
import type { OAuthReq } from "@boxyhq/saml-jackson";
import type { NextApiResponse } from "next";
import { NextRequest, NextResponse } from "next/server";

export const GET = async (req: NextRequest, res: NextApiResponse) => {
  const { oauthController } = await jackson();
  const searchParams = Object.fromEntries(req.nextUrl.searchParams);
  const isSAMLSSOEnabled = await getIsSAMLSSOEnabled();

  if (!isSAMLSSOEnabled) {
    return res.status(400).send("SAML SSO is not enabled in your Formbricks license");
  }

  if (req.method !== "GET") {
    return res.status(400).send("Method not allowed");
  }

  try {
    const { redirect_url } = await oauthController.authorize(searchParams as unknown as OAuthReq);

    return NextResponse.redirect(redirect_url as string);
  } catch (err) {
    const { message, statusCode = 500 } = err;

    return Response.json({ message }, { status: statusCode });
  }
};
