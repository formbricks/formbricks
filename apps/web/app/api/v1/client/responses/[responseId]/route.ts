import { responses } from "@/lib/api/response";
import { prisma } from "@formbricks/database";
import { INTERNAL_SECRET, WEBAPP_URL } from "@formbricks/lib/constants";
import { NextResponse } from "next/server";

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function PUT(request: Request, params: { responseId: string }): Promise<NextResponse> {
  const { responseId } = params;
  const { response } = await request.json();

  if (!response) {
    return responses.missingFieldResponse("response", true);
  }

  const currentResponse = await prisma.response.findUnique({
    where: {
      id: responseId,
    },
    select: {
      data: true,
      survey: {
        select: {
          environmentId: true,
        },
      },
    },
  });

  if (!currentResponse) {
    return responses.notFoundResponse("Response", responseId, true);
  }

  const environmentId = currentResponse.survey.environmentId;

  const newResponseData = {
    ...JSON.parse(JSON.stringify(currentResponse?.data)),
    ...response.data,
  };

  // update response
  const responseData = await prisma.response.update({
    where: {
      id: responseId,
    },
    data: {
      ...{ ...response, data: newResponseData },
    },
  });

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
      event: "responseUpdated",
      data: { id: responseId, ...response },
    }),
  });

  if (response.finished) {
    // send response to pipeline
    // don't await to not block the response
    fetch(`${WEBAPP_URL}/api/pipeline`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        internalSecret: INTERNAL_SECRET,
        environmentId,
        event: "responseFinished",
        data: responseData,
      }),
    });
  }

  return responses.successResponse({ ...responseData }, true);
}
