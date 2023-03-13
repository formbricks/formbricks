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
  const session = await getSession({ req });
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
      blocks: true,
    },
  });

  const form = await prisma.form.findUnique({
    where: {
      id: formId,
    },
  });

  const pages = getFormPages(noCodeForm.blocks, formId);
  const pagesFormated = formatPages(pages);
  const submissions = {};

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
      const pageTitle = pagesFormated[event.data["pageName"]]?.title;
      let goodAnswer = 0;
      const length = event.data["submission"]
        ? Object.keys(event.data["submission"]).length
        : 0;
      const isFinanceStep = pageTitle?.toLowerCase().includes("finance");
      let candidateResponse = {};

      if (pageTitle?.toLowerCase().includes("test") || isFinanceStep) {
        if (event.data["submission"]) {
          Object.keys(event.data["submission"]).map((key) => {
            const submission = {};
            const response = event.data["submission"][key];
            goodAnswer =
              pagesFormated[event.data["pageName"]].blocks[key]?.data
                ?.response === response
                ? goodAnswer + 1
                : goodAnswer;

            const question =
              pagesFormated[event.data["pageName"]].blocks[key]?.data.label;
            submission[question] = response;
            candidateResponse[question] = response;
          });
          // event.data["submission"]["score"] = goodAnswer / length;
          if (isFinanceStep) {
            if (
              Object.values(candidateResponse)
                [Object.values(candidateResponse).length - 1]?.split(" ")[1]
                ?.replace("*", "")
                ?.includes("pr")
            ) {
              submissions[pageTitle] = "p";
            } else {
              submissions[pageTitle] = parseInt(
                Object.values(candidateResponse)
                  [Object.values(candidateResponse).length - 1]?.split(" ")[1]
                  ?.replace("*", ""),
                10
              );
            }
          } else {
            submissions[pageTitle] = (goodAnswer / length) * 100;
          }
        }
      }
    });

    Object.values(pagesFormated).map(({ title }) => {
      if (
        title &&
        !submissions[title] &&
        title.toLowerCase().includes("test")
      ) {
        submissions[title] = 0;
      } else if (title && !submissions[title]) {
        submissions[title] = "";
      }
    });

    const error = validateEvents(events);
    if (error) {
      const { status, message } = error;
      return res.status(status).json({ error: message });
    }
    res.json({ success: true });
    for (const event of events) {
      // event.data =  {...event.data, ...form, submissions}
      event.data = { ...event.data, formId, formName: form.name, submissions };
      delete event.data.createdAt;
      delete event.data.updatedAt;
      delete event.data.ownerId;
      delete event.data.formType;
      delete event.data.answeringOrder;
      delete event.data.description;
      delete event.data.dueDate;
      delete event.data.schema;
      const candidateEvent = { user: session.user, ...event };
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
