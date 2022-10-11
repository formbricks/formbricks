import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import NextCors from "nextjs-cors";
import { formHasOwnership } from "../../../../../lib/api";
import { prisma } from "database";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
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
    // check if session exist
    const session = await getSession({ req: req });
    if (!session) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    // check if user is form owner
    const ownership = await formHasOwnership(session, formId);
    if (!ownership) {
      return res.status(401).json({
        message: "You are not authorized to access this form and their submissions",
      });
    }

    const submissionSessionsData = await prisma.submissionSession.findMany({
      where: {
        form: { id: formId },
      },
      orderBy: [
        {
          createdAt: "desc",
        },
      ],
      include: {
        events: true,
      },
    });
    return res.json(submissionSessionsData);
  }

  // PUBLIC
  // POST /api/forms/:id/submissionSessions
  // Creates a new submission session
  // Required fields in body: -
  // Optional fields in body: -
  if (req.method === "POST") {
    const prismaRes = await prisma.submissionSession.create({
      data: { form: { connect: { id: formId } } },
    });
    return res.json(prismaRes);
  }
  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
