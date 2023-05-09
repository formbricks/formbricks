import { getSessionUser } from "@/lib/api/apiHelper";
import { populateEnvironment } from "@/lib/populate";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";
import { EnvironmentType } from "@formbricks/database/generated";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // Check Authentication
  const user: any = await getSessionUser(req, res);
  if (!user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  // GET
  if (req.method === "GET") {
    // find first production enviroment of the user
    const firstMembership = await prisma.membership.findFirst({
      where: {
        userId: user.id,
      },
      select: {
        teamId: true,
      },
    });

    if (!firstMembership) {
      // create a new team and return environment
      const membership = await prisma.membership.create({
        data: {
          accepted: true,
          role: "owner",
          user: { connect: { id: user.id } },
          team: {
            create: {
              name: `${user.name}'s Team`,
              products: {
                create: {
                  name: "My Product",
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
              },
            },
          },
        },
        include: {
          team: {
            include: {
              products: {
                include: {
                  environments: true,
                },
              },
            },
          },
        },
      });

      const environment = membership.team.products[0].environments[0];

      return res.json(environment);
      // return res.status(404).json({ message: "No memberships found" });
    }

    const firstProduct = await prisma.product.findFirst({
      where: {
        teamId: firstMembership.teamId,
      },
      select: {
        id: true,
      },
    });
    if (firstProduct === null) {
      return res.status(404).json({ message: "No products found" });
    }
    const firstEnvironment = await prisma.environment.findFirst({
      where: {
        productId: firstProduct.id,
        type: "production",
      },
      select: {
        id: true,
      },
    });
    if (firstEnvironment === null) {
      return res.status(404).json({ message: "No environments found" });
    }
    return res.json(firstEnvironment);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
