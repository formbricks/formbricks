import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import NextCors from "nextjs-cors";
import { processApiEvent, validateEvents } from "../../../../lib/apiEvents";
import { formatPages, getFormPages } from "../../../../lib/utils";
import { prisma } from "../../../../lib/prisma";

///api/submissionsession
export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getSession({req});
  await NextCors(req, res, {
    // Options
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
    origin: "*",
    optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
  });

  const formId = req.query.id.toString();

  const noCodeForm = await prisma.noCodeForm.findUnique({
    where: {
       formId,
    },
    select: {
      blocks: true
    }
  })

  const form = await prisma.form.findUnique({
    where: {
       id:formId,
    },
  })



  const pages= getFormPages(noCodeForm.blocks, formId)
  const pagesFormated = formatPages(pages)
  const submissions = {}

let candidateEvents = await prisma.sessionEvent.findMany({
  where: {
    AND: [
      { type: "pageSubmission" },
      {
        data: {
          path: ["candidateId"],
          equals: session.user.id,
        },
      },
      {
        data: {
          path: ["formId"],
          equals: formId,
        },
      },
    ],
  },
  orderBy: [
    {
      createdAt: "asc",
    },
  ],
});




  if (req.method === "POST") {
    const { events } = req.body;

    candidateEvents = [...events, ...candidateEvents];
    
    candidateEvents.map((event) => {
      if(pagesFormated[event.data["pageName"]]) {
        const pageTitle = pagesFormated[event.data["pageName"]].title;
        const responses = {}
        if(event.data["submission"]) {
          Object.keys(event.data["submission"]).map((key) => {
            const submission = {}
            const question = pagesFormated[event.data["pageName"]].blocks[key]?.data.label;
            const response = event.data["submission"][key];
             submission[question] = response
            responses[question] = response
          })
        }
        submissions[pageTitle] = responses
      }
      
    })
    const error = validateEvents(events);
    if (error) {
      const { status, message } = error;
      return res.status(status).json({ error: message });
    }
    res.json({ success: true });
      for (const event of events) {
        event.data =  {...event.data, ...form, submissions}
        const candidateEvent = {user: session.user ,  ...event}
      processApiEvent(candidateEvent, formId, session.user.id);
    }
  }
  // Unknown HTTP Method
  else {
    throw new Error(
      `The HTTP ${req.method} method is not supported by this route.`
    );
  }
}
