import { hasEnvironmentAccess } from "@/lib/api/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
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
        stripeCustomerId: true,
      },
    });

    if (team === null) {
      return res.status(404).json({ message: "This product doesn't exist" });
    }
    return res.json(team);
  }
  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
