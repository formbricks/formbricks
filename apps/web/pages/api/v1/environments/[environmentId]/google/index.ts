import { authorize } from "@/lib/google";
import { searchFile } from "@/lib/google";

import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {

  // GET
  if (req.method === "GET") {
     res.send(await authorize().then(searchFile))
  }
  else {
    throw new Error(`errr`);
  }
}
