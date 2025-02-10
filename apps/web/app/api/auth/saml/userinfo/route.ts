import { responses } from "@/app/lib/api/response";
import jackson from "@/modules/ee/sso/lib/jackson";
import type { NextApiRequest, NextApiResponse } from "next";
import z from "zod";

const extractAuthToken = (req: NextApiRequest) => {
  const authHeader = req.headers["authorization"];
  const parts = (authHeader || "").split(" ");
  if (parts.length > 1) return parts[1];

  // check for query param
  let arr: string[] = [];
  const { access_token } = requestQuery.parse(req.query);
  arr = arr.concat(access_token);
  if (arr[0].length > 0) return arr[0];

  throw responses.unauthorizedResponse();
};

const requestQuery = z.object({
  access_token: z.string(),
});

export async function GET(req: NextApiRequest, res: NextApiResponse) {
  const { oauthController } = await jackson();
  const token = extractAuthToken(req);

  const user = await oauthController.userInfo(token);

  return res.json(user);
}
