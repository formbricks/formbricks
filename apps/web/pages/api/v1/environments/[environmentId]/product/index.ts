import { getSessionUser, hasEnvironmentAccess } from "@/lib/api/apiHelper";
import { prisma } from "@formbricks/database";
import { EnvironmentType } from "@prisma/client";
import { populateEnvironment } from "@/lib/populate";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const environmentId = req.query?.environmentId?.toString();

  if (!environmentId) {
    return res.status(400).json({ message: "Missing environmentId" });
  }

  const currentUser: any = await getSessionUser(req, res);

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

  // POST
  else if (req.method === "POST") {
    const { name } = req.body;

    // Get the teamId of the current environment
    const environment = await prisma.environment.findUnique({
      where: { id: environmentId },
      select: {
        product: {
          select: {
            teamId: true,
          },
        },
      },
    });

    if (!environment) {
      res.status(404).json({ error: "Environment not found" });
      return;
    }

    // Create a new product and associate it with the current team
    const newProduct = await prisma.product.create({
      data: {
        name,
        team: {
          connect: { id: environment.product.teamId },
        },
        environments: {
          create: [
            {
              type: EnvironmentType.production,
              ...populateEnvironment,
            },
            {
              type: EnvironmentType.development,
              ...populateEnvironment,
            },
          ],
        },
      },
      select: {
        environments: true,
      },
    });

    const firstEnvironment = newProduct.environments[0];
    res.json(firstEnvironment);
  }

  // DELETE
  else if (req.method === "DELETE") {
    const membership = await prisma.membership.findUnique({
      where: {
        userId_teamId: {
          userId: currentUser.id,
          teamId: currentUser.teamId,
        },
      },
    });
    if (membership?.role !== "admin" && membership?.role !== "owner") {
      return res.status(403).json({ message: "You are not allowed to delete products." });
    }
    const environment = await prisma.environment.findUnique({
      where: { id: environmentId },
      select: {
        productId: true,
      },
    });

    if (environment === null) {
      return res.status(404).json({ message: "This environment doesn't exist" });
    }

    // Delete the product with
    const prismaRes = await prisma.product.delete({
      where: { id: environment.productId },
    });

    return res.json(prismaRes);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
