import { captureTelemetry } from "@/../../packages/lib/telemetry";
import { hasEnvironmentAccess, getSessionUser } from "@/lib/api/apiHelper";
import { prisma } from "@formbricks/database/src/client";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const environmentId = req.query.environmentId?.toString();
  const productId = req.query.productId?.toString();

  // Check Authentication
  const currentUser = await getSessionUser(req, res);
  if (!currentUser) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  // Check environmentId
  if (!environmentId) {
    return res.status(400).json({ message: "Invalid environmentId" });
  }

  // Check productId
  if (!productId) {
    return res.status(400).json({ message: "Invalid productId" });
  }

  // Check whether user has access to the environment
  const hasAccess = await hasEnvironmentAccess(req, res, environmentId);

  if (!hasAccess) {
    return res.status(403).json({ message: "You are not authorized to access this environment! " });
  }

  // GET /api/environments/[environmentId]/product/[productId]/tags

  // Get all tags for a product

  if (req.method === "GET") {
    let tags;

    try {
      tags = await prisma.tag.findMany({
        where: {
          productId,
        },
      });
    } catch (e) {
      return res.status(500).json({ message: "Internal Server Error" });
    }

    captureTelemetry(`tags retrived for product ${productId}`);
    return res.json(tags);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
