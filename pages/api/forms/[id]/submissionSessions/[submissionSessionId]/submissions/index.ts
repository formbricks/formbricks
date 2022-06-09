import type { NextApiResponse, NextApiRequest } from "next";
import NextCors from "nextjs-cors";
import { prisma } from "../../../../../../../lib/prisma";

///api/submissionSession
export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const submissionSessionId = req.query.submissionSessionId.toString();
  // POST /api/forms/:id/submissionSessions/:submissionSessionId/submissions
  // Creates a new submission
  // Required fields in body: elementId, data
  // Optional fields in body: -

  await NextCors(req, res, {
    // Options
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
    origin: "*",
    optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
  });
  if (req.method === "POST") {
    const { pageName, data } = req.body;
    const prismaRes = await prisma.submission.create({
      data: {
        data,
        pageName,
        submissionSession: { connect: { id: submissionSessionId } },
      },
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
