import { getSessionOrUser } from "@/lib/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // Check Authentication
  const user: any = await getSessionOrUser(req, res);
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
    if (firstMembership === null) {
      return res.status(404).json({ message: "No memberships found" });
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
