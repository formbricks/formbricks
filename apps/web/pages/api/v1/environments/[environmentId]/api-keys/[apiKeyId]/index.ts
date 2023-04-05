import { hasEnvironmentAccess } from "@/lib/api/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const environmentId = req.query.environmentId?.toString();
  const apiKeyId = req.query.apiKeyId?.toString();

  if (!apiKeyId || !environmentId) {
    return res.status(400).json({ message: "Missing apiKeyId or environmentId" });
  }

  if (!(await hasEnvironmentAccess(req, res, environmentId))) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  // DELETE /api/environments/:environmentId/api-keys/:apiKeyId
  // Deletes an existing API Key
  // Required fields in body: environmentId, apiKeyId
  // Optional fields in body: -
  if (req.method === "DELETE") {
    const prismaRes = await prisma.apiKey.delete({
      where: { id: apiKeyId },
    });
    return res.json(prismaRes);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
