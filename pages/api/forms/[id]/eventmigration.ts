import type { NextApiRequest, NextApiResponse } from "next";
import NextCors from "nextjs-cors";
import { processApiEvent, validateEvents } from "../../../../lib/apiEvents";
import {
  computeStepScore,
  formatPages,
  formatScoreSummary,
  getFormPages,
  syncCandidatesEvents,
} from "../../../../lib/utils";
import { prisma } from "../../../../lib/prisma";
import { setCandidateSubmissionCompletedEvent } from "./event";

///api/submissionsession
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
  const candidates = await prisma.user.findMany({
    where: {
      id: {
        in: sessionEventsData.map((event) => event.data["candidateId"]),
      },
    },
  });

  const updateCandidatesEvents = [];

  const allEvents = await prisma.sessionEvent.findMany({
    where: {
      AND: [
        { type: "pageSubmission" },

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

  let flag = 0;
  const NB_QUERIES = 1;

  Promise.all(
    candidates.map(async (candidate) => {
      const submissions = {};
      if (req.method === "POST") {
        const { events } = req.body;

        const candidateEvents = allEvents.filter(({ data }) => {
          return data?.candidateId === candidate.id;
        });
        let pagesSubmited = [];
        const formTotalPages = Object.keys(pagesFormated).length - 1;

        candidateEvents.map((event) => {
          const pageTitle = pagesFormated[event.data["pageName"]]?.title;
          let goodAnswer = 0;
          const length = event.data["submission"]
            ? Object.keys(event.data["submission"]).length
            : 0;
          const isFinanceStep = pageTitle?.toLowerCase().includes("finance");
          const isAdminiInfos =
            pageTitle?.toLowerCase().includes("administratif") ||
            pageTitle?.toLowerCase().includes("administratif");
          let candidateResponse = {};

          const ispageExistInPagesSubmited = pagesSubmited.findIndex(
            (title) => title === pageTitle
          );
          if (ispageExistInPagesSubmited < 0 && pageTitle)
            pagesSubmited.push(pageTitle);

          computeStepScore(
            pageTitle,
            isFinanceStep,
            event,
            goodAnswer,
            pagesFormated,
            candidateResponse,
            submissions,
            length,
            isAdminiInfos
          );
        });

        Object.values(pagesFormated).map(({ title }) => {
          if (
            title &&
            submissions[title] === 0 &&
            title.toLowerCase().includes("test")
          ) {
            submissions[title] = 0;
          } else if (
            title &&
            isNaN(parseInt(submissions[title])) &&
            title.toLowerCase().includes("test")
          ) {
            submissions[title] = "";
          } else if (
            title &&
            !submissions[title] &&
            (!title?.toLowerCase().includes("administratif") ||
              !title?.toLowerCase().includes("administratif"))
          ) {
            submissions[title] = "";
          }
        });

        await setCandidateSubmissionCompletedEvent(
          candidate.id,
          formId,
          pagesSubmited,
          formTotalPages,
          events
        );

        const error = validateEvents(events);
        if (error) {
          submissions;
          const { status, message } = error;
          return res.status(status).json({ error: message });
        }

        formatScoreSummary(events, formId, form, submissions);
        events[0].type = "scoreSummary";
        const candidateEvent = { user: candidate, ...events[0] };

        updateCandidatesEvents.push({
          candidateEvent,
          formId,
          candidateId: candidate.id,
          candidateName: `${candidate.firstname} - ${candidate.lastname}`,
        });
      } else {
        throw new Error(
          `The HTTP ${req.method} method is not supported by this route.`
        );
      }
    })
  ).then(() => {
    syncCandidatesEvents(
      updateCandidatesEvents,
      flag,
      NB_QUERIES,
      processApiEvent
    );
  });
  res.json({ success: true });
}
