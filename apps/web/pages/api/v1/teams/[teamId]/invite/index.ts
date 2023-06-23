import { getSessionUser, hasTeamAccess, isAdminOrOwner } from "@/lib/api/apiHelper";
import { sendInviteMemberEmail } from "@/lib/email";
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

  if (process.env.NEXT_PUBLIC_INVITE_DISABLED === "1") {
    return res.status(403).json({ message: "Invite Disabled" });
  }

  const hasOwnerOrAdminAccess = await isAdminOrOwner(currentUser, teamId);
  if (!hasOwnerOrAdminAccess) {
    return res.status(403).json({ message: "Not authorized" });
  }

  // POST /api/v1/teams/[teamId]/invite
  if (req.method === "POST") {
    let { email, name, role } = req.body;
    email = email.toLowerCase();

    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const member = await prisma.membership.findUnique({
        where: {
          userId_teamId: { teamId, userId: user.id },
        },
      });
      if (member) {
        return res.status(409).json({ message: "User is already a member of this team" });
      }
    }

    const expiresIn = 7 * 24 * 60 * 60 * 1000; // 7 days
    const expiresAt = new Date(Date.now() + expiresIn);

    const invite = await prisma.invite.create({
      data: {
        email,
        name,
        team: { connect: { id: teamId } },
        creator: { connect: { id: currentUser.id } },
        acceptor: user ? { connect: { id: user.id } } : undefined,
        role,
        expiresAt,
      },
    });

    await sendInviteMemberEmail(invite.id, currentUser.name, name, email);

    return res.status(201).json(invite);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
