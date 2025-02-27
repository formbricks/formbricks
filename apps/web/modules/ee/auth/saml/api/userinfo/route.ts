import { extractAuthToken } from "@/modules/ee/auth/saml/api/userinfo/lib/utils";
import jackson from "@/modules/ee/auth/saml/lib/jackson";

export const GET = async (req: Request) => {
  const { oauthController } = await jackson();
  const token = extractAuthToken(req);

  const user = await oauthController.userInfo(token);

  return Response.json(user);
};
