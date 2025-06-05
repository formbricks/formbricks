import { responses } from "@/app/lib/api/response";
import jackson from "@/modules/ee/auth/saml/lib/jackson";
import { OAuthTokenReq } from "@boxyhq/saml-jackson";

export const POST = async (req: Request) => {
  const jacksonInstance = await jackson();
  if (!jacksonInstance) {
    return responses.forbiddenResponse("SAML SSO is not enabled in your Formbricks license");
  }
  const { oauthController } = jacksonInstance;

  const body = await req.formData();
  console.log("saml/token: body", body);
  const formData = Object.fromEntries(body.entries());
  console.log("saml/token: formData", formData);

  const response = await oauthController.token(formData as unknown as OAuthTokenReq);

  console.log("saml/token: response", response);

  return Response.json(response);
};
