import { getSessionOrUser } from "@/lib/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

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
    // GET /api/v1/teams/[teamId]/members
    // Get a all members of an organisation
    if (req.method === "GET") {
        // get current team id by environment id
        const environment = await prisma.environment.findUnique({
            where: {
                id: environmentId,
            },
        });
        if (environment === null) {
            return res.status(400).json({ message: "Invalid environment ID" });
        }
        const team = await prisma.product.findUnique({
            where: {
                id: environment.productId,
            },
            select: {
                teamId: true,
            }
        });
        const teamId = team?.teamId;
        if (teamId === undefined) {
            return res.status(400).json({ message: "Missing teamId" });
        }

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
                .json({ message: "You don't have access to this organisation or this organisation doesn't exist" });
        }

        // // get all members of the organisation
        const members = await prisma.membership.findMany({
            where: {
                teamId,
            },
            select: {
                user: {
                    select: {
                        name: true,
                        email: true,
                    }
                },
                userId: true,
                accepted: true,
                role: true,
            },
        });

        members.forEach((member) => {
            member.name = member.user.name;
            member.email = member.user.email;
            delete member.user;
        });

        return res.json({ members, teamId });
    }

    // Unknown HTTP Method
    else {
        throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
    }
}
