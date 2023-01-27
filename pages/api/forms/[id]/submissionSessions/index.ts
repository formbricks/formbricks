import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
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
  const session = await getSession({ req: req });

  // GET /api/forms
  // Gets all forms of a user
  if (req.method === "GET") {
    // check if session exist
    if (!session) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const submissionSessionsData = await prisma.submissionSession.findMany({
      where: {
        form: { id: formId },
      },
      orderBy: [
        {
          updatedAt: "desc",
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
    const sessionEvent = await prisma.sessionEvent.findFirst({
      where: {
        AND: [
          {
            data: {
              path: ["formId"],
              equals: formId,
            },
          },
          {
            data: {
              path: ["candidatId"],
              equals: session.user.id,
            },
          },
        ],
      },
    });

    if (sessionEvent === null) {
      const prismaRes = await prisma.submissionSession.create({
        data: { form: { connect: { id: formId } } },
      });

      return res.json(prismaRes);
    } else {
      const submissionSession = await prisma.submissionSession.findFirst({
        where: {
          id: sessionEvent.submissionSessionId,
        },
      });

      return res.json(submissionSession);
    }
  }
  // Unknown HTTP Method
  else {
    throw new Error(
      `The HTTP ${req.method} method is not supported by this route.`
    );
  }
}
