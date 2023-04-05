import { hasEnvironmentAccess } from "@/lib/api/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const environmentId = req.query?.environmentId?.toString();

  const hasAccess = await hasEnvironmentAccess(req, res, environmentId);
  if (!hasAccess) {
    return res.status(403).json({ message: "Not authorized" });
  }
  // GET
  if (req.method === "GET") {
    const environment = await prisma.environment.findUnique({
      where: {
        id: environmentId,
      },
      select: {
        productId: true,
      },
    });
    if (environment === null) {
      return res.status(404).json({ message: "This environment doesn't exist" });
    }
    const product = await prisma.product.findUnique({
      where: {
        id: environment.productId,
      },
      include: {
        environments: {
          select: {
            id: true,
            type: true,
          },
        },
      },
    });

    if (product === null) {
      return res.status(404).json({ message: "This product doesn't exist" });
    }
    return res.json(product);
  }

  // PUT
  else if (req.method === "PUT") {
    const data = { ...req.body, updatedAt: new Date() };
    const environment = await prisma.environment.findUnique({
      where: {
        id: environmentId,
      },
      select: {
        productId: true,
      },
    });
    if (environment === null) {
      return res.status(404).json({ message: "This environment doesn't exist" });
    }
    const prismaRes = await prisma.product.update({
      where: { id: environment.productId },
      data,
    });
    return res.json(prismaRes);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
