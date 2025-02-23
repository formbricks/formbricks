import jackson from "@/modules/ee/sso/lib/jackson";
import { OAuthTokenReq } from "@boxyhq/saml-jackson";

export async function POST(req: Request) {
  const { oauthController } = await jackson();

  const body = await req.formData();
  const formData = Object.fromEntries(body.entries());

  const response = await oauthController.token(formData as unknown as OAuthTokenReq);

  return Response.json(response);
}
