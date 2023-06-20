import { captureTelemetry } from "@/../../packages/lib/telemetry";
import { hasEnvironmentAccess, getSessionUser } from "@/lib/api/apiHelper";
import { prisma } from "@formbricks/database/src/client";
import { Prisma } from "@prisma/client";
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

  // POST /api/environments/[environmentId]/product/[productId]/tags

  // Create a new tag for a product (with name and responseId)

  if (req.method === "POST") {
    // let name: string;
    // let responseId: string;

    const name = req.body.name;

    if (!name) {
      return res.status(400).json({ message: "Invalid name" });
    }

    // try {
    //   name = JSON.parse(req.body).name;
    // } catch (e) {
    //   return res.status(400).json({ message: "Invalid name" });
    // }

    // try {
    //   responseId = JSON.parse(req.body).responseId;
    // } catch (e) {
    //   return res.status(400).json({ message: "Invalid responseId" });
    // }

    let tag;

    try {
      tag = await prisma.tag.create({
        data: {
          name,
          productId,
          // responses: {
          //   create: {
          //     responseId,
          //   },
          // },
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === "P2002") {
          return res.status(400).json({ message: "Tag already exists" });
        }
      }
      return res.status(500).json({ message: "Internal Server Error" });
    }

    // captureTelemetry(`tag created for product ${productId} with name ${name} and responseId ${responseId}`);
    return res.json(tag);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
