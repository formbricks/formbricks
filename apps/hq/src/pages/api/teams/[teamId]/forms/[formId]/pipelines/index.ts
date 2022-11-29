import { getSessionOrUser } from "@/lib/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // Check Authentication
  const user: any = await getSessionOrUser(req, res);
  if (!user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const teamId = req.query.teamId.toString();
  const formId = req.query.formId.toString();

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

  // GET /api/teams[teamId]/forms/[formId]/pipelines
  // Get pipelines
  if (req.method === "GET") {
    // get submission
    const pipelines = await prisma.pipeline.findMany({
      where: {
        form: {
          id: formId,
          teamId,
        },
      },
    });

    return res.json(pipelines);
  }

  // POST /api/teams[teamId]/forms/[formId]/pipelines
  // Create a new pipeline
  // Required fields in body: name, type
  // Optional fields in body: enabled, config
  else if (req.method === "POST") {
    const pipeline = req.body;

    // create form in db
    const result = await prisma.pipeline.create({
      data: {
        ...pipeline,
        form: { connect: { id: formId } },
      },
    });
    res.json(result);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
