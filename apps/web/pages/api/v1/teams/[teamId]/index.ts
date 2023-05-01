import { getSessionUser, hasTeamAccess } from "@/lib/api/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // Check Authentication

  const currentUser: any = await getSessionUser(req, res);
  if (!currentUser) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const teamId = req.query.teamId?.toString();
  if (teamId === undefined) {
    return res.status(400).json({ message: "Missing teamId" });
  }

  const hasAccess = await hasTeamAccess(currentUser, teamId);
  if (!hasAccess) {
    return res.status(403).json({ message: "Not authorized" });
  }

  // PUT /api/v1/teams/[teamId]
  // Update a team
  if (req.method === "PUT") {
    const { name } = req.body;
    if (name === undefined) {
      return res.status(400).json({ message: "Missing name" });
    }

    // check if currentUser is owner of the team
    const membership = await prisma.membership.findUnique({
      where: {
        userId_teamId: {
          userId: currentUser.id,
          teamId,
        },
      },
    });
    if (membership?.role !== "owner") {
      return res.status(403).json({ message: "You are not allowed to update this team" });
    }

    // update team
    const team = await prisma.team.update({
      where: {
        id: teamId,
      },
      data: {
        name,
      },
    });
    return res.json(team);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
