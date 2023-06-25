import { hasEnvironmentAccess } from "@/lib/api/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const environmentId = req.query?.environmentId?.toString();

  if (!environmentId) {
    return res.status(400).json({ message: "Missing environmentId" });
  }

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
      include: {
        product: {
          select: {
            id: true,
            name: true,
            teamId: true,
            brandColor: true,
            environments: true,
          },
        },
      },
    });

    if (environment === null) {
      return res.status(404).json({ message: "This environment doesn't exist" });
    }

    const products = await prisma.product.findMany({
      where: {
        teamId: environment.product.teamId,
      },
      select: {
        id: true,
        name: true,
        brandColor: true,
        environments: {
          where: {
            type: "production",
          },
          select: {
            id: true,
          },
        },
      },
    });

    return res.json({ ...environment, availableProducts: products });
  }

  if (req.method === "PUT") {
    const data = { ...req.body, updatedAt: new Date() };
    const prismaRes = await prisma.environment.update({
      where: { id: environmentId },
      data,
    });
    return res.json(prismaRes);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
