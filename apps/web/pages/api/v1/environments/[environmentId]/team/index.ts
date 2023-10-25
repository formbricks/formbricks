import { getSessionUser, hasEnvironmentAccess, isOwner } from "@/app/lib/api/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const currentUser: any = await getSessionUser(req, res);
  if (!currentUser) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  const environmentId = req.query?.environmentId?.toString();

  if (!environmentId) {
    return res.status(400).json({ message: "Missing environmentId" });
  }

  const hasAccess = await hasEnvironmentAccess(req, res, environmentId);
  if (!hasAccess) {
    return res.status(403).json({ message: "Not authorized" });
  }
  // GET
  if (req.method === "GET") {
    const environment = await prisma.environment.findUnique({
      where: {
        id: environmentId,
      },
      select: {
        product: {
          select: {
            teamId: true,
          },
        },
      },
    });
    if (environment === null) {
      return res.status(404).json({ message: "This environment doesn't exist" });
    }
    const team = await prisma.team.findUnique({
      where: {
        id: environment.product.teamId,
      },
      select: {
        id: true,
        name: true,
        subscription: true,
      },
    });

    if (team === null) {
      return res.status(404).json({ message: "This team doesn't exist" });
    }
    return res.json(team);
  }

  // DELETE
  else if (req.method === "DELETE") {
    try {
      const environment = await prisma.environment.findUnique({
        where: {
          id: environmentId,
        },
        select: {
          product: {
            select: {
              teamId: true,
            },
          },
        },
      });
      if (environment === null) {
        return res.status(404).json({ message: "This environment doesn't exist" });
      }

      const team = await prisma.team.findUnique({
        where: {
          id: environment.product.teamId,
        },
        select: {
          id: true,
          name: true,
          subscription: true,
        },
      });
      if (team === null) {
        return res.status(404).json({ message: "This team doesn't exist" });
      }

      const hasOwnership = isOwner(currentUser, team.id);
      if (!hasOwnership) {
        return res.status(403).json({ message: "You are not allowed to delete this team" });
      }

      const prismaRes = await prisma.team.delete({
        where: {
          id: team.id,
        },
      });

      return res.status(200).json({ deletedTeam: prismaRes });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
