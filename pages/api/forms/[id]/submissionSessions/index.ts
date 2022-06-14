import type { NextApiRequest, NextApiResponse } from "next";
import NextCors from "nextjs-cors";
import { prisma } from "../../../../../lib/prisma";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse
) {
  await NextCors(req, res, {
    // Options
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
    origin: "*",
    optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
  });
  const formId = req.query.id.toString();

  // GET /api/forms
  // Gets all forms of a user
  if (req.method === "GET") {
    const submissionSessionsData = await prisma.submissionSession.findMany({
      where: {
        form: { id: formId },
      },
      include: {
        events: true,
      },
    });
    return res.json(submissionSessionsData);
  }

  // POST /api/forms/:id/submissionSessions
  // Creates a new submission session
  // Required fields in body: -
  // Optional fields in body: -
  if (req.method === "POST") {
    const { userFingerprint } = req.body;
    const prismaRes = await prisma.submissionSession.create({
      data: { userFingerprint, form: { connect: { id: formId } } },
    });
    return res.json(prismaRes);
  }
  // Unknown HTTP Method
  else {
    throw new Error(
      `The HTTP ${req.method} method is not supported by this route.`
    );
  }
}
