import { responses } from "@/app/lib/api/response";
import jackson from "@/modules/ee/auth/saml/lib/jackson";
import z from "zod";

const extractAuthToken = (req: Request) => {
  const authHeader = req.headers.get("authorization");
  const parts = (authHeader || "").split(" ");
  if (parts.length > 1) return parts[1];

  // check for query param
  let arr: string[] = [];
  const { access_token } = requestQuery.parse(req.url);
  arr = arr.concat(access_token);
  if (arr[0].length > 0) return arr[0];

  throw responses.unauthorizedResponse();
};

const requestQuery = z.object({
  access_token: z.string(),
});

export const GET = async (req: Request) => {
  const { oauthController } = await jackson();
  const token = extractAuthToken(req);

  const user = await oauthController.userInfo(token);

  return Response.json(user);
};
