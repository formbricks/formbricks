import { getSessionOrUser } from "@/lib/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // Check Authentication
  const user: any = await getSessionOrUser(req, res);
  if (!user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const workspaceId = req.query.workspaceId.toString();

  const customerId = req.query.customerId.toString();

  // check workspace permission
  const membership = await prisma.membership.findUnique({
    where: {
      userId_workspaceId: {
        userId: user.id,
        workspaceId,
      },
    },
  });
  if (membership === null) {
    return res
      .status(403)
      .json({ message: "You don't have access to this workspace or this workspace doesn't exist" });
  }

  // GET /api/workspaces[workspaceId]/customers/[customerId]
  // Get a specific workspace
  if (req.method === "GET") {
    const customer = await prisma.customer.findUnique({
      where: {
        id_workspaceId: {
          id: customerId,
          workspaceId,
        },
      },
      include: {
        submissions: true,
      },
    });

    return res.json(customer);
  }

  // POST /api/workspaces[workspaceId]/customer/[customerId]
  // Replace a specific customer
  else if (req.method === "POST") {
    const data = { ...req.body, updatedAt: new Date() };
    const prismaRes = await prisma.customer.update({
      where: {
        id_workspaceId: {
          id: customerId,
          workspaceId,
        },
      },
      data,
    });
    return res.json(prismaRes);
  }

  // Delete /api/workspaces[workspaceId]/customer/[customerId]
  // Deletes a single customer
  else if (req.method === "DELETE") {
    const prismaRes = await prisma.customer.delete({
      where: {
        id_workspaceId: {
          id: customerId,
          workspaceId: workspaceId,
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
