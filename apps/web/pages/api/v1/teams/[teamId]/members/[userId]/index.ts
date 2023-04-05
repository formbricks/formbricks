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

  const userId = req.query.userId?.toString();
  if (userId === undefined) {
    return res.status(400).json({ message: "Missing userId" });
  }

  // DELETE /api/v1/teams/[teamId]/members/[userId]
  // Remove a member from a team
  if (req.method === "DELETE") {
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
      return res.status(403).json({ message: "You are not allowed to delete member froms this team" });
    } else if (membership?.role === "owner" && userId === currentUser.id) {
      return res.status(403).json({ message: "You cannot delete yourself from this team" });
    }

    //delete membership
    const membershipToDelete = await prisma.membership.delete({
      where: {
        userId_teamId: {
          userId,
          teamId,
        },
      },
    });
    return res.json(membershipToDelete);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
