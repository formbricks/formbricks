import { getSessionUser } from "@/lib/api/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // Check Authentication
  const user: any = await getSessionUser(req, res);
  if (!user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  // GET
  if (req.method === "GET") {
    // get memberships
    const memberships = await prisma.membership.findMany({
      where: {
        userId: user.id,
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            products: {
              select: {
                id: true,
                name: true,
                environments: {
                  select: {
                    id: true,
                    type: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    return res.json(memberships);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
