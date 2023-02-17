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

  const organisationId = req.query.organisationId.toString();
  const formId = req.query.formId.toString();
  const pipelineId = req.query.pipelineId.toString();

  // check organisation permission
  const membership = await prisma.membership.findUnique({
    where: {
      userId_organisationId: {
        userId: user.id,
        organisationId,
      },
    },
  });
  if (membership === null) {
    return res
      .status(403)
      .json({ message: "You don't have access to this organisation or this organisation doesn't exist" });
  }

  // GET /api/organisations[organisationId]/forms/[formId]/pipelines/[pipelineId]
  // Get a specific pipeline
  if (req.method === "GET") {
    const pipeline = await prisma.pipeline.findFirst({
      where: {
        id: pipelineId,
        formId: formId,
      },
    });

    return res.json(pipeline);
  }

  // POST /api/organisations[organisationId]/forms/[formId]/pipelines/[pipelineId]
  // Replace a specific pipeline
  else if (req.method === "POST") {
    const data = { ...req.body, updatedAt: new Date() };
    const prismaRes = await prisma.pipeline.update({
      where: { id: pipelineId },
      data,
    });
    return res.json(prismaRes);
  }

  // Delete /api/organisations[organisationId]/forms/[formId]/pipelines/[pipelineId]
  // Deletes a single form
  else if (req.method === "DELETE") {
    const prismaRes = await prisma.pipeline.delete({
      where: { id: pipelineId },
    });
    capturePosthogEvent(user.id, "pipeline deleted", {
      formId,
      pipelineId,
    });
    return res.json(prismaRes);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
