import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import { prisma } from "../../../../lib/prisma";
import NextCors from "nextjs-cors";
import { processApiEvent, validateEvents } from "../../../../lib/apiEvents";
import { openFormEvent } from "../../../../lib/types";

///api/submissionSession
export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getSession({ req });
  await NextCors(req, res, {
    // Options
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
    origin: "*",
    optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
  });

  const formId = req.query.id.toString();

  // POST /api/forms/:id/schema
  // Updates a form schema
  // Required fields in body: schema
  // Optional fields in body: -
  if (req.method === "POST") {
    const formLastSessionEvent = await prisma.sessionEvent.findFirst({
      where: {
        AND: [
          { data: { path: ["formId"], equals: formId } },
          { type: "formOpened" },
        ],
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const events: openFormEvent[] = [
      {
        type: "formOpened",
        data: {
          formId,
          userId: session.user.id,
          roll: parseInt(
            formLastSessionEvent ? formLastSessionEvent.data["roll"] + 1 : 0
          ),
        },
      },
    ];
    const error = validateEvents(events);
    if (error) {
      const { status, message } = error;
      return res.status(status).json({ error: message });
    }
    res.json({ success: true });
    for (const event of events) {
      processApiEvent(event, formId, session.user.id);
    }
  }
  // Unknown HTTP Method
  else {
    throw new Error(
      `The HTTP ${req.method} method is not supported by this route.`
    );
  }
}
