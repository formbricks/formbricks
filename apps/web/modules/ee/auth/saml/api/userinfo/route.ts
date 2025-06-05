import { responses } from "@/app/lib/api/response";
import { extractAuthToken } from "@/modules/ee/auth/saml/api/userinfo/lib/utils";
import jackson from "@/modules/ee/auth/saml/lib/jackson";

export const GET = async (req: Request) => {
  const jacksonInstance = await jackson();
  if (!jacksonInstance) {
    return responses.forbiddenResponse("SAML SSO is not enabled in your Formbricks license");
  }
  const { oauthController } = jacksonInstance;
  const token = extractAuthToken(req);
  console.log("saml/userinfo: token", token);
  const user = await oauthController.userInfo(token);
  console.log("saml/userinfo: user", user);
  return Response.json(user);
};
