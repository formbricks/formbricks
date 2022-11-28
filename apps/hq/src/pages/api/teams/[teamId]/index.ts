import { getSessionOrUser, hashApiKey } from "@/lib/apiHelper";
import { prisma } from "@formbricks/database";
import { randomBytes } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { unstable_getServerSession } from "next-auth";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // Check Authentication
  const user: any = await getSessionOrUser(req, res);
  if (!user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const teamId = parseInt(req.query.teamId.toString());
  if (isNaN(teamId)) {
    return res.status(400).json({ message: "Invalid teamId" });
  }

  // GET /api/teams[teamId]
  // Get a specific team
  if (req.method === "GET") {
    // check if membership exists
    const membership = await prisma.membership.findUnique({
      where: {
        userId_teamId: {
          userId: user.id,
          teamId,
        },
      },
    });
    if (membership === null) {
      return res
        .status(403)
        .json({ message: "You don't have access to this team or this team doesn't exist" });
    }
    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
      },
    });
    return res.json(team);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
