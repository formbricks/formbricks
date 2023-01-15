import { getSessionOrUser } from "@/lib/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // Check Authentication
  const user: any = await getSessionOrUser(req, res);
  if (!user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const workspaceId = req.query.workspaceId.toString();

  // GET /api/workspaces[workspaceId]
  // Get a specific workspace
  if (req.method === "GET") {
    // check if membership exists
    const membership = await prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId,
        },
      },
    });
    if (membership === null) {
      return res
        .status(403)
        .json({ message: "You don't have access to this workspace or this workspace doesn't exist" });
    }
    const workspace = await prisma.workspace.findUnique({
      where: {
        id: workspaceId,
      },
    });
    return res.json(workspace);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
