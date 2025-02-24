import jackson from "@/modules/ee/auth/saml/jackson";
import { OAuthTokenReq } from "@boxyhq/saml-jackson";

export const POST = async (req: Request) => {
  const { oauthController } = await jackson();

  const body = await req.formData();
  const formData = Object.fromEntries(body.entries());

  const response = await oauthController.token(formData as unknown as OAuthTokenReq);

  return Response.json(response);
};
