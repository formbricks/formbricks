import { hasEnvironmentAccess, hashApiKey } from "@/lib/api/apiHelper";
import { prisma } from "@formbricks/database";
import { randomBytes } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const environmentId = req.query.environmentId?.toString();

  if (!environmentId) {
    return res.status(400).json({ message: "Missing environmentId" });
  }

  if (!(await hasEnvironmentAccess(req, res, environmentId))) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  // GET /api/environments/[environmentId]/api-keys/
  // Gets all ApiKeys of an environment
  if (req.method === "GET") {
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        environmentId,
      },
    });
    return res.json(apiKeys);
  }

  // POST /api/environments/:environmentId/api-keys
  // Creates an API Key
  // Optional fields in body: label
  if (req.method === "POST") {
    const apiKey = req.body;
    const key = randomBytes(16).toString("hex");
    // Create API Key in the database
    const result = await prisma.apiKey.create({
      data: {
        ...apiKey,
        hashedKey: hashApiKey(key),
        environment: { connect: { id: environmentId } },
      },
    });
    res.json({ ...result, apiKey: key });
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
