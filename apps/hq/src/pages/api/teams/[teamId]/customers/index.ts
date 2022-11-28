import { getSessionOrUser } from "@/lib/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

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

  // check team permission
  const membership = await prisma.membership.findUnique({
    where: {
      userId_teamId: {
        userId: user.id,
        teamId,
      },
    },
  });
  if (membership === null) {
    return res.status(403).json({ message: "You don't have access to this team or this team doesn't exist" });
  }

  // GET /api/teams[teamId]/customers
  // Get all customers of a specific team
  if (req.method === "GET") {
    const forms = await prisma.customer.findMany({
      where: {
        team: {
          id: teamId,
        },
      },
      include: {
        _count: {
          select: { submissions: true },
        },
      },
    });

    return res.json(forms);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
