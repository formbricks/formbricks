import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import NextCors from "nextjs-cors";
import { prisma } from "../../../../../../lib/prisma";

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
  const pageId = req.query.candidateId.toString();
  const session = await getSession({ req: req });

  // GET /api/forms/[id]/events/[pageId]/question-stats
  // Gets all page submission statistics for a specific form
  if (req.method === "GET") {
    // check if session exist
    if (!session) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const pageSubmissions = await prisma.sessionEvent.findMany({
      select: {
        data: true,
      },
      where: {
        AND: [
          { type: "pageSubmission" },
          {
            data: {
              path: ["pageName"],
              equals: pageId,
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
          updatedAt: "desc",
        },
      ],
    });
    const candidates = await Promise.all(pageSubmissions.map(async (s, index) => {


    const candidateResponse  = await prisma.user.findUnique({
        select: {
          firstname: true,
          lastname: true,
          gender: true,
          email: true,
          whatsapp: true,
          id: true
        },
        where:  {
          id: s.data["candidateId"]
        }
      })
      return {...candidateResponse, submission: pageSubmissions[index].data?.submission};

    }));
    
      const responses = pageSubmissions.map((s) => s.data["submission"]);


    let qStats = {};
    // candidates.map((r) => {
    // if (r)
    //     Object.keys(r.submission).map((qId) => {
    //       const addOrIncrementOption = (opt) => {
    //         if (qStats[qId][opt]) qStats[qId][opt].push(r);
    //         else qStats[qId][opt] = [r];
    //       };
    //       if (!qStats[qId]) qStats[qId] = {};
    //       if (typeof r.submission[qId] !== "object") addOrIncrementOption(r.submission[qId]);
    //       else {
    //         for (const opt of r.submission[qId]) addOrIncrementOption(opt);
    //       }
    //     });
    // });
    responses.map((r) => {
      if (r)
          Object.keys(r).map((qId) => {
            const addOrIncrementOption = (opt) => {
              if (qStats[qId][opt]) qStats[qId][opt] += 1;
              else qStats[qId][opt] = 1;
            };
            if (!qStats[qId]) qStats[qId] = {};
            if (typeof r[qId] !== "object") addOrIncrementOption(r[qId]);
            else {
              for (const opt of r[qId]) addOrIncrementOption(opt);
            }
          });
      });

    return res.json({  qStats });
  }

  // Unknown HTTP Method
  else {
    throw new Error(
      `The HTTP ${req.method} method is not supported by this route.`
    );
  }
}
