import type { NextApiResponse, NextApiRequest } from "next";
import { getSession } from "next-auth/react";
import { hasOwnership } from "@/lib/apiHelper";
import { prisma } from "@formbricks/database";
import { unstable_getServerSession } from "next-auth";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // Check Authentication
  const session = await unstable_getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const apiKeyId = req.query.apiKeyId.toString();

  const ownership = await hasOwnership("apiKey", session, apiKeyId);
  if (!ownership) {
    return res.status(401).json({ message: "You are not authorized to access this apiKey" });
  }

  // GET /api/users/me/api-keys/:apiKeyId
  // Get apiKey with specific id
  if (req.method === "GET") {
    const apiKey = await prisma.apiKey.findUnique({
      where: {
        id: apiKeyId,
      },
    });
    if (apiKey === null) return res.status(404).json({ error: "not found" });
    return res.json(apiKey);
  }
  // DELETE /api/users/me/api-keys/:apiKeyId
  // Deletes an existing apiKey
  // Required fields in body: -
  // Optional fields in body: -
  else if (req.method === "DELETE") {
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
