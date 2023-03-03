import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import NextCors from "nextjs-cors";
import { processApiEvent, validateEvents } from "../../../../lib/apiEvents";
import { formatPages, getFormPages } from "../../../../lib/utils";
import { prisma } from "../../../../lib/prisma";
import { computeScore } from "../../../../lib/computeScore";

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

  const candidates = await prisma.user.findMany({
    where: {
      role: "PUBLIC",
    },
    skip: 0,
    take: 20
  })


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

// console.log({candidates})
  Promise.all( candidates.map(async(candidate, )=> {
    
    


  if (req.method === "POST") {
    const { events } = req.body;

    const candidateEvents = allEvents.filter(
      ({ data }) => {
       
       return data?.candidateId === candidate.id}
    );
            console.log('_______________________________________________________________________________')
              console.log({candidate: `${candidate.firstname} ${candidate.lastname}`})

              const candidateLastEvent = candidateEvents;
           candidateLastEvent.map(event => {
          const pageTitle = pagesFormated[event.data["pageName"]]?.title
          let goodAnswer = 0;
          const length = event.data["submission"]
          ? Object.keys(event.data["submission"]).length
          : 0;
          const isFinanceStep = pageTitle?.toLowerCase().includes('finance')
          let candidateResponse = {};

          if(pageTitle?.toLowerCase().includes('test') || isFinanceStep) {
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
              if(isFinanceStep) {
                if (
                        Object.values(candidateResponse)
                          [Object.values(candidateResponse).length - 1]?.split(" ")[1]
                          ?.replace("*", "")
                          ?.includes("pr")
                      ) {
                        submissions[pageTitle] = "p";
                        console.log(pageTitle,  "p")
                      } else {
                        submissions[pageTitle] = parseInt(
                          Object.values(candidateResponse)
                            [Object.values(candidateResponse).length - 1]?.split(" ")[1]
                            ?.replace("*", ""),
                          10
                        );

                        console.log(pageTitle, submissions[pageTitle])

                      }
              } else {
                submissions[pageTitle] =  (goodAnswer / length) * 100;
                console.log(pageTitle,  (goodAnswer / length) * 100)
              }
              
            }
          }
              
           })
    
    const error = validateEvents(events);
    if (error) {
      const { status, message } = error;
      return res.status(status).json({ error: message });
    }
    
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
      const candidateEvent = { user: candidate, ...event };
    
      updateCandidatesEvents.push({
        candidateEvent,
        formId,
        candidateId: candidate.id,
        candidateName: `${candidate.firstname} - ${candidate.lastname}`,
      });
    }
    
     
  }
  else {
    throw new Error( 
      `The HTTP ${req.method} method is not supported by this route.`
    );
  }
  })).then(() => {
    syncCandidatesEvents(updateCandidatesEvents)
  })

  let flag = 0;
  const NB_QUERIES = 1
  const syncCandidatesEvents = (updateCandidatesEvents) => {
    Promise.all(updateCandidatesEvents
        .slice(flag, flag + NB_QUERIES)
        .map(updateCandidateEvent => {

          // console.log({updateCandidateEvent: updateCandidateEvent.candidateEvent.data, name: updateCandidateEvent.candidateName, cId: updateCandidateEvent.candidateId})
    // return processApiEvent(
          //   updateCandidateEvent.candidateEvent,
          //   updateCandidateEvent.formId,
          //   updateCandidateEvent.candidateId
          // )
        })
    ).then(() => {
      flag += NB_QUERIES;
      if (flag < updateCandidatesEvents.length) {
          setTimeout(() => {
            syncCandidatesEvents(updateCandidatesEvents)
          }, 1000)
      }
    });
  }

  // await  processApiEvent(candidateEvent, formId, candidate.id);

  res.json({ success: true });
}
