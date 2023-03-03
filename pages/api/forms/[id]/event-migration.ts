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
      role: "PUBLIC"
    },
    skip: 0,
    take: 4000
  })

  console.log({candidatesLength: candidates.length})

  const updateCandidatesEvents = [];


  Promise.all( candidates.map(async(candidate, i)=> {
    let candidateEvents = await prisma.sessionEvent.findMany({
      where: {
        AND: [
          { type: "pageSubmission" },
          {
            data: {
              path: ["candidateId"],
              equals: candidate.id,
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
        
        const candidateResponse = {}
        const length = event.data["submission"] ? Object.keys(event.data["submission"]).length : 0;
        let stepQuestionsHasResponseField = false;
        let goodAnswer = 0;
        if(event.data["submission"]) {
          Object.keys(event.data["submission"]).map((key) => {
            const submission = {}
            
            if(pagesFormated[event?.data["pageName"]]?.blocks[key]?.data?.response ) {
              stepQuestionsHasResponseField = true;
            }
            const response = event.data["submission"][key];
            goodAnswer =  
            pagesFormated[event.data["pageName"]].blocks[key]?.data?.response === response ? goodAnswer + 1 
            : goodAnswer;
            
        const question = pagesFormated[event.data["pageName"]].blocks[key]?.data.label;
             submission[question] = response
            candidateResponse[question] = response
          })
          event.data["submission"]["score"] = goodAnswer  / length;

        }
        if(stepQuestionsHasResponseField) {

          submissions[pageTitle] =  (goodAnswer  / length) * 100
        } else {
          submissions[pageTitle] = Object.values(candidateResponse)[0]
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
        event.data =  {...event.data, submissions}
        delete event.data.createdAt;
        delete event.data.updatedAt;
        delete event.data.ownerId;
        delete event.data.formType;
        delete event.data.answeringOrder;
        delete event.data.description;
        delete event.data.dueDate;
        delete event.data.schema;
        const candidateEvent = {user: candidate ,  ...event}

        // console.log({candidateEvent})
      
        updateCandidatesEvents.push({
          candidateEvent,
          formId,
          candidateId : candidate.id
        });

        // await  processApiEvent(candidateEvent, formId, candidate.id);
    }
  }
  // Unknown HTTP Method
  else {
    throw new Error( 
      `The HTTP ${req.method} method is not supported by this route.`
    );
  }
  })).then(() => {
    syncCandidatesEvents(updateCandidatesEvents)
  })

  let flag = 0;
  const NB_QUERIES = 10
  const syncCandidatesEvents = (updateCandidatesEvents) => {
    Promise.all(updateCandidatesEvents
        .slice(flag, flag + NB_QUERIES)
        .map(updateCandidateEvent => {
          return processApiEvent(
            updateCandidateEvent.candidateEvent,
            updateCandidateEvent.formId,
            updateCandidateEvent.candidateId
          )
        })
    ).then(() => {
      console.log('status', flag + '-' + (flag + NB_QUERIES))
      flag += NB_QUERIES;
      if (flag < updateCandidatesEvents.length) {
          setTimeout(() => {
            syncCandidatesEvents(updateCandidatesEvents)
          }, 2000)
      }
    });
  }

  // await  processApiEvent(candidateEvent, formId, candidate.id);

  res.json({ success: true });
}
