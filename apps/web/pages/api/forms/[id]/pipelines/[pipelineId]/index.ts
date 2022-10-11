import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import NextCors from "nextjs-cors";
import { formHasOwnership } from "../../../../../../lib/api";
import { prisma } from "database";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  await NextCors(req, res, {
    // Options
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
    origin: "*",
    optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
  });

  // Check Authentication
  const session = await getSession({ req: req });
  if (!session) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const formId = req.query.id.toString();
  const pipelineId = req.query.pipelineId.toString();

  const ownership = await formHasOwnership(session, formId);
  if (!ownership) {
    return res.status(401).json({
      message: "You are not authorized to access this pipeline",
    });
  }

  // GET /api/forms/:id/pipelines/[pipelineId]
  // Get pipeline with a specific id
  if (req.method === "GET") {
    const data = await prisma.pipeline.findUnique({
      where: {
        id: pipelineId,
      },
    });
    return res.json(data);
  }

  // POST /api/forms/:id/pipelines/:pipelineId
  // Updates an existing pipeline
  // Required fields in body: type
  // Optional fields in body: enabled, data
  else if (req.method === "POST") {
    const data = { ...req.body, updatedAt: new Date() };
    const prismaRes = await prisma.pipeline.update({
      where: { id: pipelineId },
      data,
    });
    return res.json(prismaRes);
  }

  // DELETE /api/forms/:id/pipelines/:pipelineId
  // deletes an existing pipeline
  if (req.method === "DELETE") {
    const prismaRes = await prisma.pipeline.delete({
      where: { id: pipelineId },
    });
    return res.json(prismaRes);
  }
  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
