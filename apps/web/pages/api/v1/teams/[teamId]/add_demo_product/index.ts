import { NextApiRequest, NextApiResponse } from "next";
import { INTERNAL_SECRET } from "@formbricks/lib/constants";
import { createDemoProduct } from "@formbricks/lib/services/team";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // Check Authentication

  if (req.headers["x-api-key"] !== INTERNAL_SECRET) {
    return res.status(401).json({
      code: "not_authenticated",
      message: "Not authenticated",
      details: {
        "x-Api-Key": "Header not provided or API Key invalid",
      },
    });
  }

  const teamId = req.query.teamId?.toString();
  if (teamId === undefined) {
    return res.status(400).json({ message: "Missing teamId" });
  }

  if (req.method === "POST") {
    try {
      const demoProduct = await createDemoProduct(teamId);
      return res.json(demoProduct);
    } catch (err) {
      throw new Error(err);
    }
  }
}
