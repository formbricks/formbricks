import { getSessionOrUser } from "@/lib/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // Check Authentication
  const user: any = await getSessionOrUser(req, res);
  if (!user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const environmentId = req.query?.environmentId?.toString();

  // GET
  if (req.method === "GET") {
    const environment = await prisma.environment.findUnique({
      where: {
        id: environmentId,
      },
      include: {
        product: {
          select: {
            name: true,
            teamId: true,
          },
        },
      },
    });
    if (environment === null) {
      return res.status(404).json({ message: "This environment doesn't exist" });
    }
    // check if membership exists
    const membership = await prisma.membership.findUnique({
      where: {
        userId_teamId: {
          userId: user.id,
          teamId: environment.product.teamId,
        },
      },
    });
    if (membership === null) {
      return res
        .status(403)
        .json({ message: "You don't have access to this organisation or this organisation doesn't exist" });
    }
    return res.json(environment);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
