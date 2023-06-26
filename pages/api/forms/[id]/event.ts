import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import NextCors from "nextjs-cors";
import { processApiEvent, validateEvents } from "../../../../lib/apiEvents";
import {
  computeStepScore,
  formatPages,
  formatScoreSummary,
  getFormPages,
  setCandidateSubmissionCompletedEvent,
} from "../../../../lib/utils";
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
    let pagesSubmited = [];
    const formTotalPages = Object.keys(pagesFormated).length - 1;

    candidateEvents.map((event) => {
      const pageTitle = pagesFormated[event.data["pageName"]]?.title;
      let goodAnswer = 0;
      const length = event.data["submission"]
        ? Object.keys(event.data["submission"]).length
        : 0;
      const isFinanceStep = pageTitle?.toLowerCase().includes("finance");
      const isAdminiInfos = pageTitle?.toLowerCase().includes("administratif") || pageTitle?.toLowerCase().includes("administratif");
      let candidateResponse = {};

      const ispageExistInPagesSubmited = pagesSubmited.findIndex(
        (title) => title === pageTitle
      );
      if (ispageExistInPagesSubmited < 0 && pageTitle)
        pagesSubmited.push(pageTitle);

      if (pageTitle?.toLowerCase().includes("test") || isFinanceStep || isAdminiInfos) {
        computeStepScore(pageTitle, isFinanceStep, event, goodAnswer, pagesFormated, candidateResponse, submissions, length, isAdminiInfos);

      }
    });

    Object.values(pagesFormated).map(({ title }) => {
      if (
        title &&
        !submissions[title] &&
        title.toLowerCase().includes("test")
      ) {
        submissions[title] = 0;
      } else if (title && !submissions[title] && (!title?.toLowerCase().includes("administratif") || !title?.toLowerCase().includes("administratif"))) {
        submissions[title] = "";
      }
    });

    await setCandidateSubmissionCompletedEvent(
      session.user.id,
      formId,
      pagesSubmited,
      formTotalPages,
      events
    );

    const error = validateEvents(events);
    if (error) {
      const { status, message } = error;
      return res.status(status).json({ error: message });
    }
    res.json({ success: true });
    events[0].data = {
      ...events[0].data,
      formId,
      formName: form.name,
      submissions,
    };
    formatScoreSummary(events, formId, form, submissions);
    const candidateEvent = { user: session.user, ...events[0] };
    processApiEvent(candidateEvent, formId, session.user.id);
  }
  // Unknown HTTP Method
  else {
    throw new Error(
      `The HTTP ${req.method} method is not supported by this route.`
    );
  }
}