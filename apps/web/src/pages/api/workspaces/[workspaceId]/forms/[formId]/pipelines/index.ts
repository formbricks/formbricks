import { getSessionOrUser } from "@/lib/apiHelper";
import { capturePosthogEvent } from "@/lib/posthog";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // Check Authentication
  const user: any = await getSessionOrUser(req, res);
  if (!user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const workspaceId = req.query.workspaceId.toString();
  const formId = req.query.formId.toString();

  // check workspace permission
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

  // GET /api/workspaces[workspaceId]/forms/[formId]/pipelines
  // Get pipelines
  if (req.method === "GET") {
    // get submission
    const pipelines = await prisma.pipeline.findMany({
      where: {
        form: {
          id: formId,
          workspaceId,
        },
      },
    });

    return res.json(pipelines);
  }

  // POST /api/workspaces[workspaceId]/forms/[formId]/pipelines
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
    capturePosthogEvent(workspaceId, "pipeline created", {
      formId,
      pipelineId: result.id,
    });
    res.json(result);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
