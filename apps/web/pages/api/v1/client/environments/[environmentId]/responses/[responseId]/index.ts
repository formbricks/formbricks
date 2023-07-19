import { INTERNAL_SECRET, WEBAPP_URL } from "@formbricks/lib/constants";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";
import { TPipelineInput } from "@formbricks/types/v1/pipelines";
import { updateResponse } from "@formbricks/lib/services/response";
import { sendToPipeline } from "@/lib/pipelines";

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

    const updatedResponse = await updateResponse(responseId, { ...response, data: newResponseData });

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
        surveyId: updatedResponse.surveyId,
        event: "responseUpdated",
        response: updatedResponse,
      } as TPipelineInput),
    });

    if (response.finished) {
      // send response to pipeline
      // don't await to not block the response
      sendToPipeline({
        environmentId,
        surveyId: updatedResponse.surveyId,
        event: "responseFinished",
        response: updatedResponse,
      });
    }

    return res.json({ message: "Response updated" });
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
