import { responses } from "@/lib/api/response";
import { transformErrorToDetails } from "@/lib/api/validator";
import { sendToPipeline } from "@/lib/pipelines";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/errors";
import { updateResponse } from "@formbricks/lib/services/response";
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

  // update response
  let response;
  try {
    response = await updateResponse(responseId, inputValidation.data);
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      return responses.notFoundResponse("Response", responseId, true);
    }
    if (error instanceof InvalidInputError) {
      return responses.badRequestResponse(error.message);
    }
    if (error instanceof DatabaseError) {
      return responses.internalServerErrorResponse(error.message);
    }
  }

  // get survey to get environmentId
  let survey;
  try {
    survey = await getSurvey(response.surveyId);
  } catch (error) {
    if (error instanceof InvalidInputError) {
      return responses.badRequestResponse(error.message);
    }
    if (error instanceof DatabaseError) {
      return responses.internalServerErrorResponse(error.message);
    }
  }

  // send response update to pipeline
  // don't await to not block the response
  sendToPipeline({
    event: "responseUpdated",
    environmentId: survey.environmentId,
    surveyId: survey.id,
    // only send the updated fields
    data: {
      ...response,
      data: inputValidation.data.data,
    },
  });

  if (response.finished) {
    // send response to pipeline
    // don't await to not block the response
    sendToPipeline({
      event: "responseFinished",
      environmentId: survey.environmentId,
      surveyId: survey.id,
      data: response,
    });
  }

  return responses.successResponse(response, true);
}
