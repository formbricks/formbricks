import { getSessionUser, isAdminOrOwner } from "@/lib/api/apiHelper";
import { sendInviteMemberEmail } from "@/lib/email";
import { createInviteToken } from "@/lib/jwt";
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

  const inviteId = req.query.inviteId?.toString();
  if (inviteId === undefined) {
    return res.status(400).json({ message: "Missing inviteId" });
  }

  const hasOwnerOrAdminAccess = await isAdminOrOwner(currentUser, teamId);
  if (!hasOwnerOrAdminAccess) {
    return res.status(403).json({ message: "You are not allowed to create or modify invites in this team" });
  }

  // PATCH /api/v1/teams/[teamId]/invite/[inviteId]
  // Update an invited member's role
  if (req.method === "PATCH") {
    const { role } = req.body;
    // check if invite exists
    const invite = await prisma.invite.findUnique({
      where: {
        id: inviteId,
      },
      select: {
        creator: true,
        email: true,
        name: true,
      },
    });

    if (!invite) {
      return res.status(403).json({ message: "You are not allowed to update this invite", invite });
    }

    // update invite with new role
    const updatedInvite = await prisma.invite.update({
      where: {
        id: inviteId,
      },
      data: {
        role,
      },
    });
    return res.status(200).json(updatedInvite);
  }

  // DELETE /api/v1/teams/[teamId]/invite/[inviteId]
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
    if (membership?.role !== "owner" || membership?.role !== "owner") {
      return res.status(403).json({ message: "You are not allowed to delete members from this team" });
    }

    //delete invite
    const inviteToDelete = await prisma.invite.delete({
      where: {
        id: inviteId,
      },
    });
    return res.json(inviteToDelete);
  }
  // PUT /api/v1/teams/[teamId]/invite/[inviteId]
  // Renew an invite
  else if (req.method === "PUT") {
    // resend invite mail to user and update invite expiration date
    const invite = await prisma.invite.findUnique({
      where: {
        id: inviteId,
      },
      select: {
        creator: true,
        email: true,
        name: true,
      },
    });

    if (!invite) {
      return res.status(403).json({ message: "You are not allowed to resend this invite" });
    }
    await sendInviteMemberEmail(inviteId, invite?.creator.name, invite?.name, invite?.email);

    const updatedInvite = await prisma.invite.update({
      where: {
        id: inviteId,
      },
      data: {
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      },
    });

    return res.status(200).json(updatedInvite);
  }
  // GET /api/v1/teams/[teamId]/invite/[inviteId]
  // Retrieve an invite token
  else if (req.method === "GET") {
    const invite = await prisma.invite.findUnique({
      where: {
        id: inviteId,
      },
      select: {
        email: true,
      },
    });

    if (!invite) {
      return res.status(403).json({ message: "You are not allowed to share this invite link" });
    }

    const inviteToken = createInviteToken(inviteId, invite?.email, {
      expiresIn: "7d",
    });

    return res.status(200).json({ inviteToken: encodeURIComponent(inviteToken) });
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
