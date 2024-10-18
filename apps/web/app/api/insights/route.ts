import { headers } from "next/headers";
import { z } from "zod";
import { CRON_SECRET } from "@formbricks/lib/constants";
import { responses } from "../../lib/api/response";
import { transformErrorToDetails } from "../../lib/api/validator";
import { generateInsightsEnabledForSurveyQuestions, generateInsightsForSurveyResponses } from "./lib/utils";

const ZGenerateInsightsInput = z.object({
  surveyId: z.string(),
});

export const POST = async (request: Request) => {
  try {
    // Check authentication
    if (headers().get("x-api-key") !== CRON_SECRET) {
      return responses.notAuthenticatedResponse();
    }

    const jsonInput = await request.json();
    const inputValidation = ZGenerateInsightsInput.safeParse(jsonInput);

    if (!inputValidation.success) {
      console.error(inputValidation.error);
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      );
    }

    const { surveyId } = inputValidation.data;

    const data = await generateInsightsEnabledForSurveyQuestions(surveyId);

    if (!data.success) {
      return responses.successResponse({ message: "No insights enabled questions found" });
    }

    await generateInsightsForSurveyResponses(data.survey);

    return responses.successResponse({ message: "Insights generated successfully" });
  } catch (error) {
    throw error;
  }
};
