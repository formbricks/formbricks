import { getSessionOrUser } from "@/lib/api/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

type Member = {
  user?: {
    name: string | null;
    email: string;
  };
  accepted: boolean;
  userId: string;
  role: any;
  name?: string;
  email?: string;
};

type Invite = {
  accepted: boolean;
  id?: string;
  inviteId?: string;
  name: string | null;
  email: string;
  acceptorId: string | null;
  role: any;
};

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // Check Authentication
  const user: any = await getSessionOrUser(req, res);
  if (!user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const environmentId = req.query.environmentId?.toString();
  if (environmentId === undefined) {
    return res.status(400).json({ message: "Missing environmentId" });
  }

  if (req.method === "GET") {
    const environment = await prisma.environment.findUnique({
      where: { id: environmentId },
      include: {
        product: {
          select: {
            teamId: true,
            team: {
              select: {
                memberships: {
                  where: { userId: user.id },
                },
              },
            },
          },
        },
      },
    });

    if (!environment) {
      return res.status(400).json({ message: "Invalid environment ID" });
    }

    const teamId = environment.product.teamId;

    if (!teamId || environment.product.team.memberships.length === 0) {
      return res.status(403).json({
        message: "You don't have access to this organisation or this organisation doesn't exist",
      });
    }

    const members: Member[] = await prisma.membership.findMany({
      where: { teamId },
      select: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        userId: true,
        accepted: true,
        role: true,
      },
    });
    members.forEach((member: Member) => {
      member.name = member.user?.name || "";
      member.email = member.user?.email || "";
      delete member.user;
    });

    const invitees: Invite[] = await prisma.invite.findMany({
      where: { teamId, accepted: false },
      select: {
        id: true,
        name: true,
        email: true,
        acceptorId: true,
        role: true,
        accepted: true,
      },
    });
    invitees.forEach((invite: Invite) => {
      invite.inviteId = invite.id;
      delete invite.id;
    });

    return res.json({ members, invitees, teamId });
  } else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
