import { sendToPipeline } from "@/app/lib/pipelines";
import { prisma } from "@formbricks/database";
import { INTERNAL_SECRET, WEBAPP_URL } from "@formbricks/lib/constants";
import { transformPrismaPerson } from "@formbricks/lib/person/service";
import { responseCache } from "@formbricks/lib/response/cache";
import { TPipelineInput } from "@formbricks/types/pipelines";
import { TResponse } from "@formbricks/types/responses";
import { TTag } from "@formbricks/types/tags";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const environmentId = req.query.environmentId?.toString();

  if (!environmentId) {
    return res.status(400).json({ message: "Missing environmentId" });
  }

  const responseId = req.query.responseId?.toString();

  if (!responseId) {
    return res.status(400).json({ message: "Missing responseId" });
  }

  // CORS
  if (req.method === "OPTIONS") {
    res.status(200).end();
  }

  // POST
  else if (req.method === "PUT") {
    const { response } = req.body;

    const currentResponse = await prisma.response.findUnique({
      where: {
        id: responseId,
      },
      select: {
        data: true,
      },
    });

    if (!currentResponse) {
      return res.status(400).json({ message: "Response not found" });
    }

    const newResponseData = {
      ...JSON.parse(JSON.stringify(currentResponse?.data)),
      ...response.data,
    };

    const responsePrisma = await prisma.response.update({
      where: {
        id: responseId,
      },
      data: {
        ...response,
        data: newResponseData,
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        surveyId: true,
        finished: true,
        data: true,
        ttc: true,
        meta: true,
        personAttributes: true,
        singleUseId: true,
        person: {
          select: {
            id: true,
            userId: true,
            environmentId: true,
            createdAt: true,
            updatedAt: true,
            attributes: {
              select: {
                value: true,
                attributeClass: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        notes: {
          select: {
            id: true,
            createdAt: true,
            updatedAt: true,
            text: true,
            user: {
              select: {
                id: true,
                name: true,
              },
            },
            isResolved: true,
            isEdited: true,
          },
        },
        tags: {
          select: {
            tag: {
              select: {
                id: true,
                createdAt: true,
                updatedAt: true,
                name: true,
                environmentId: true,
              },
            },
          },
        },
      },
    });

    // update response cache
    responseCache.revalidate({
      id: responseId,
      surveyId: responsePrisma.surveyId,
      environmentId,
    });

    const responseData: TResponse = {
      ...responsePrisma,
      person: responsePrisma.person ? transformPrismaPerson(responsePrisma.person) : null,
      tags: responsePrisma.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
    };

    // send response update to pipeline
    // don't await to not block the response
    fetch(`${WEBAPP_URL}/api/pipeline`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        internalSecret: INTERNAL_SECRET,
        environmentId,
        surveyId: responseData.surveyId,
        event: "responseUpdated",
        response: responseData,
      } as TPipelineInput),
    });

    if (response.finished) {
      // send response to pipeline
      // don't await to not block the response
      sendToPipeline({
        environmentId,
        surveyId: responseData.surveyId,
        event: "responseFinished",
        response: responseData,
      });
    }

    return res.json({ message: "Response updated" });
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
