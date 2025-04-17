import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { sendToPipeline } from "@/app/lib/pipelines";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { headers } from "next/headers";
import { UAParser } from "ua-parser-js";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { capturePosthogEnvironmentEvent } from "@formbricks/lib/posthogServer";
import { getSurvey } from "@formbricks/lib/survey/service";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { InvalidInputError } from "@formbricks/types/errors";
import { TResponse } from "@formbricks/types/responses";
import { TSurveyQuestionChoice, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { createResponse } from "./lib/response";
import { TResponseInputV2, ZResponseInputV2 } from "./types/response";

interface Context {
  params: Promise<{
    environmentId: string;
  }>;
}

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse({}, true);
};

export const POST = async (request: Request, context: Context): Promise<Response> => {
  const params = await context.params;
  const requestHeaders = await headers();
  let responseInput;
  try {
    responseInput = await request.json();
  } catch (error) {
    return responses.badRequestResponse("Invalid JSON in request body", { error: error.message }, true);
  }

  const { environmentId } = params;
  const environmentIdValidation = ZId.safeParse(environmentId);
  const responseInputValidation = ZResponseInputV2.safeParse({ ...responseInput, environmentId });

  if (!environmentIdValidation.success) {
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(environmentIdValidation.error),
      true
    );
  }

  if (!responseInputValidation.success) {
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(responseInputValidation.error),
      true
    );
  }

  const userAgent = request.headers.get("user-agent") || undefined;
  const agent = new UAParser(userAgent);

  const country =
    requestHeaders.get("CF-IPCountry") ||
    requestHeaders.get("X-Vercel-IP-Country") ||
    requestHeaders.get("CloudFront-Viewer-Country") ||
    undefined;

  const responseInputData = responseInputValidation.data;

  if (responseInputData.contactId) {
    const isContactsEnabled = await getIsContactsEnabled();
    if (!isContactsEnabled) {
      return responses.forbiddenResponse("User identification is only available for enterprise users.", true);
    }
  }

  // get and check survey
  const survey = await getSurvey(responseInputData.surveyId);
  if (!survey) {
    return responses.notFoundResponse("Survey", responseInputData.surveyId, true);
  }
  if (survey.environmentId !== environmentId) {
    return responses.badRequestResponse(
      "Survey is part of another environment",
      {
        "survey.environmentId": survey.environmentId,
        environmentId,
      },
      true
    );
  }

  const MAX_OTHER_OPTION_LENGTH = 250;

  // Validate response data for "other" options exceeding character limit
  for (const questionId of Object.keys(responseInputData.data)) {
    const question = survey.questions.find((q) => q.id === questionId);
    if (
      question?.type === TSurveyQuestionTypeEnum.MultipleChoiceMulti ||
      question?.type === TSurveyQuestionTypeEnum.MultipleChoiceSingle
    ) {
      const answer = responseInputData.data[questionId];

      /**
       * Helper function to check if a string value is a valid "other" option
       * @returns BadRequestResponse if the value exceeds the limit, undefined otherwise
       */
      const validateOtherOptionLength = (
        value: string,
        choices: TSurveyQuestionChoice[]
      ): Response | undefined => {
        // Check if this is an "other" option (not in predefined choices)
        const matchingChoice = choices.find(
          (choice) => getLocalizedValue(choice.label, responseInputData.language ?? "default") === value
        );

        // If this is an "other" option with value that's too long, reject the response
        if (!matchingChoice && value.length > MAX_OTHER_OPTION_LENGTH) {
          return responses.badRequestResponse("Other option text is too long", { questionId }, true);
        }
        return undefined;
      };

      // Handle single choice responses
      if (typeof answer === "string") {
        const validationResult = validateOtherOptionLength(answer, question.choices);
        if (validationResult) return validationResult;
      }
      // Handle multi-select responses
      else if (Array.isArray(answer)) {
        for (const item of answer) {
          if (typeof item === "string") {
            const validationResult = validateOtherOptionLength(item, question.choices);
            if (validationResult) return validationResult;
          }
        }
      }
    }
  }

  let response: TResponse;
  try {
    const meta: TResponseInputV2["meta"] = {
      source: responseInputData?.meta?.source,
      url: responseInputData?.meta?.url,
      userAgent: {
        browser: agent.getBrowser().name,
        device: agent.getDevice().type || "desktop",
        os: agent.getOS().name,
      },
      country: country,
      action: responseInputData?.meta?.action,
    };

    response = await createResponse({
      ...responseInputData,
      meta,
    });
  } catch (error) {
    if (error instanceof InvalidInputError) {
      return responses.badRequestResponse(error.message);
    } else {
      logger.error({ error, url: request.url }, "Error creating response");
      return responses.internalServerErrorResponse(error.message);
    }
  }

  sendToPipeline({
    event: "responseCreated",
    environmentId: survey.environmentId,
    surveyId: response.surveyId,
    response: response,
  });

  if (responseInput.finished) {
    sendToPipeline({
      event: "responseFinished",
      environmentId: survey.environmentId,
      surveyId: response.surveyId,
      response: response,
    });
  }

  await capturePosthogEnvironmentEvent(survey.environmentId, "response created", {
    surveyId: response.surveyId,
    surveyType: survey.type,
  });

  return responses.successResponse({ id: response.id }, true);
};
