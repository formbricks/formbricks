import { getSessionOrUser } from "@/lib/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // Check Authentication
  const session = await getSessionOrUser(req, res);
  if (!session) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  // GET /api/teams
  // Get all of my teams
  if (req.method === "GET") {
    const memberships = await prisma.membership.findMany({
      where: {
        user: { email: session.email },
      },
      include: {
        team: true,
      },
    });
    return res.json(memberships);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
