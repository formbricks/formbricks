import { hasEnvironmentAccess } from "@/app/lib/api/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const environmentId = req.query.environmentId?.toString();

  if (!environmentId) {
    return res.status(400).json({ message: "Missing environmentId" });
  }

  if (!(await hasEnvironmentAccess(req, res, environmentId))) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  // GET
  if (req.method === "GET") {
    const attributeClasses = await prisma.attributeClass.findMany({
      where: {
        environment: {
          id: environmentId,
        },
      },
    });

    return res.json(attributeClasses);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
