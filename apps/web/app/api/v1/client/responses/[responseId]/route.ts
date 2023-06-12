import { responses } from "@/lib/api/response";
import { transformErrorToDetails } from "@/lib/api/validator";
import { INTERNAL_SECRET, WEBAPP_URL } from "@formbricks/lib/constants";
import { getResponse, updateResponse } from "@formbricks/lib/services/response";
import { getSurvey } from "@formbricks/lib/services/survey";
import { ZResponseUpdateInput } from "@formbricks/types/v1/responses";
import { NextResponse } from "next/server";

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function PUT(
  request: Request,
  { params }: { params: { responseId: string } }
): Promise<NextResponse> {
  const { responseId } = params;
  const responseUpdate = await request.json();

  const inputValidation = ZResponseUpdateInput.safeParse(responseUpdate);

  if (!inputValidation.success) {
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(inputValidation.error),
      true
    );
  }

  // get current response
  const currentResponse = await getResponse(responseId);

  if (!currentResponse) {
    return responses.notFoundResponse("Response", responseId, true);
  }

  // get survey to get environmentId
  const survey = await getSurvey(currentResponse.surveyId);
  if (!survey) {
    // shouldn't happen as survey relation is required
    return responses.notFoundResponse("Survey", currentResponse.surveyId, true);
  }
  const environmentId = survey.environmentId;

  // update response
  const response = await updateResponse(responseId, responseUpdate);

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
      surveyId: response.surveyId,
      event: "responseUpdated",
      data: response,
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
        surveyId: response.surveyId,
        event: "responseFinished",
        data: response,
      }),
    });
  }

  return responses.successResponse(response, true);
}
