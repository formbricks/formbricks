import { getSessionOrUser } from "@/lib/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
    // Check Authentication
    const currentUser: any = await getSessionOrUser(req, res);
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
        if (membership?.role !== "owner") {
            return res
                .status(403)
                .json({ message: "You are not allowed to delete members from this team" });
        }

        //delete invite
        const inviteToDelete = await prisma.invite.delete({
            where: {
                id: inviteId,
            },
        });
        return res.json(inviteToDelete);
    }

    // Unknown HTTP Method
    else {
        throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
    }
}
