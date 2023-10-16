import { getSessionUser, hasTeamAccess, isOwner } from "@/app/lib/api/apiHelper";
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

  /**
   * Transfer ownership of a team to another member
   * @route PATCH /api/v1/teams/{teamId}/transfer-ownership
   * @param {string} teamId - The id of the team to transfer ownership of
   * @param {string} userId - The id of the user to transfer ownership to
   * @returns {object} - The updated membership of the new owner and the updated membership of the old owner
   *
   */
  if (req.method === "PATCH") {
    const { userId: newOwnerId } = req.body;

    const hasOwnerAccess = await isOwner(currentUser, teamId);

    if (!hasOwnerAccess) {
      return res.status(403).json({ message: "You must be the owner of this team to transfer ownership" });
    }

    if (newOwnerId === currentUser.id) {
      return res.status(403).json({ message: "You cannot transfer ownership to yourself" });
    }

    const isMember = await prisma.membership.findFirst({
      where: {
        userId: newOwnerId,
        teamId,
      },
    });
    if (!isMember) {
      return res.status(403).json({ message: "The new owner must be a member of the team" });
    }

    try {
      await prisma.$transaction([
        prisma.membership.update({
          where: {
            userId_teamId: {
              teamId,
              userId: currentUser.id,
            },
          },
          data: {
            role: "admin",
          },
        }),
        prisma.membership.update({
          where: {
            userId_teamId: {
              teamId,
              userId: newOwnerId,
            },
          },
          data: {
            role: "owner",
          },
        }),
      ]);
    } catch (error) {
      return res.status(500).json({ message: "Something went wrong" });
    }

    return res.json({ message: "Ownership transferred successfully" });
  }
}
