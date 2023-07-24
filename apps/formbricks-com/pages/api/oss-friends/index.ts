import { OSSFriends } from "@/pages/oss-friends";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // GET
  if (req.method === "GET") {
    return res.status(200).json({ data: OSSFriends });
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
