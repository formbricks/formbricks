import { getSessionOrUser } from "@/lib/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // Check Authentication
  const session = await getSessionOrUser(req, res);
  if (!session) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  // GET /api/users/me
  // Get the current user
  if (req.method === "GET") {
    const user = await prisma.user.findUnique({
      where: {
        email: session.email,
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        email: true,
        name: true,
        identityProvider: true,
      },
    });
    return res.json(user);
  } // GET /api/users/me
  // Get the current user
  else if (req.method === "PUT") {
    const user = await prisma.user.update({
      where: {
        email: session.email,
      },
      data: req.body,
    });
    return res.json(user);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
