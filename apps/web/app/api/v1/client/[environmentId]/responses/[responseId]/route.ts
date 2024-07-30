import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { sendToPipeline } from "@/app/lib/pipelines";
import { getLogger } from "next-logger.config";
import { getPerson } from "@formbricks/lib/person/service";
import { updateResponse } from "@formbricks/lib/response/service";
import { getSurvey } from "@formbricks/lib/survey/service";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { ZResponseUpdateInput } from "@formbricks/types/responses";

const baseLogger = getLogger({
  path: "apps/web/app/api/v1/client/[environmentId]/responses/[responseId]/route.ts",
});

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse({}, true);
};

export const PUT = async (
  request: Request,
  { params }: { params: { responseId: string } }
): Promise<Response> => {
  const { responseId } = params;
  let logger = baseLogger.child({ responseId });

  if (!responseId) {
    return responses.badRequestResponse("Response ID is missing", undefined, true);
  }

  const responseUpdate = await request.json();

  logger = logger.child({ responseUpdate });

  // legacy workaround for formbricks-js 1.2.0 & 1.2.1
  if (responseUpdate.personId && typeof responseUpdate.personId === "string") {
    const person = await getPerson(responseUpdate.personId);
    responseUpdate.userId = person?.userId;
    delete responseUpdate.personId;
  }

  const inputValidation = ZResponseUpdateInput.safeParse(responseUpdate);
  logger = logger.child({ inputValidation });

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
    logger = logger.child({ responseId: response.id, surveyId: response.surveyId, response });
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      logger.debug("Response not found");
      return responses.notFoundResponse("Response", responseId, true);
    }
    if (error instanceof InvalidInputError) {
      logger.debug(`InvalidInputError: ${error.message}`);
      return responses.badRequestResponse(error.message);
    }
    if (error instanceof DatabaseError) {
      logger.error(`DatabaseError: ${error.message}`);
      console.error(error);
      return responses.internalServerErrorResponse(error.message);
    }
  }

  // get survey to get environmentId
  let survey;
  try {
    survey = await getSurvey(response.surveyId);
    logger = logger.child({ environmentId: survey.environmentId });
  } catch (error) {
    if (error instanceof InvalidInputError) {
      logger.debug(`InvalidInputError: ${error.message}`);
      return responses.badRequestResponse(error.message);
    }
    if (error instanceof DatabaseError) {
      logger.error(`DatabaseError: ${error.message}`);
      console.error(error);
      return responses.internalServerErrorResponse(error.message);
    }
  }

  // send response update to pipeline
  // don't await to not block the response
  sendToPipeline({
    event: "responseUpdated",
    environmentId: survey.environmentId,
    surveyId: survey.id,
    response,
  });

  if (response.finished) {
    // send response to pipeline
    // don't await to not block the response
    sendToPipeline({
      event: "responseFinished",
      environmentId: survey.environmentId,
      surveyId: survey.id,
      response: response,
    });
  }

  logger.debug("Survey response updated");
  return responses.successResponse({}, true);
};
