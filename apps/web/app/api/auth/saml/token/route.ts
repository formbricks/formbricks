import jackson from "@/modules/ee/sso/lib/jackson";
import type { NextApiRequest, NextApiResponse } from "next";

export async function POST(req: NextApiRequest, res: NextApiResponse) {
  const { oauthController } = await jackson();

  const response = await oauthController.token(req.body);

  return res.json(response);
}
