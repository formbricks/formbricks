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

    const sessionEventsData = await prisma.sessionEvent.findMany({
      where: {
        type: "formOpened",
        data: {
          path: ["formId"],
          equals: formId,
        },
      },
      orderBy: [
        {
          updatedAt: "desc",
        },
      ],
    });
    const users = await prisma.user.findMany({
      where: {
        id: {
          in: sessionEventsData.map((event) => event.data["candidateId"]),
        },
      },
    });

    return res.json(users);
  }

  // Unknown HTTP Method
  else {
    throw new Error(
      `The HTTP ${req.method} method is not supported by this route.`
    );
  }
}
