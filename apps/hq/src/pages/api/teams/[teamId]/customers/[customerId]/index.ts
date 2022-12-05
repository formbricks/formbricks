import { getSessionOrUser } from "@/lib/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // Check Authentication
  const user: any = await getSessionOrUser(req, res);
  if (!user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const teamId = req.query.teamId.toString();

  const customerId = req.query.customerId.toString();

  // check team permission
  const membership = await prisma.membership.findUnique({
    where: {
      userId_teamId: {
        userId: user.id,
        teamId,
      },
    },
  });
  if (membership === null) {
    return res.status(403).json({ message: "You don't have access to this team or this team doesn't exist" });
  }

  // GET /api/teams[teamId]/customers/[customerId]
  // Get a specific team
  if (req.method === "GET") {
    const customer = await prisma.customer.findUnique({
      where: {
        id_teamId: {
          id: customerId,
          teamId,
        },
      },
      include: {
        submissions: true,
      },
    });

    return res.json(customer);
  }

  // POST /api/teams[teamId]/customer/[customerId]
  // Replace a specific customer
  else if (req.method === "POST") {
    const data = { ...req.body, updatedAt: new Date() };
    const prismaRes = await prisma.customer.update({
      where: {
        id_teamId: {
          id: customerId,
          teamId,
        },
      },
      data,
    });
    return res.json(prismaRes);
  }

  // Delete /api/teams[teamId]/customer/[customerId]
  // Deletes a single customer
  else if (req.method === "DELETE") {
    const prismaRes = await prisma.customer.delete({
      where: {
        id_teamId: {
          id: customerId,
          teamId: teamId,
        },
      },
    });
    return res.json(prismaRes);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
