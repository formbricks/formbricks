// This function can run for a maximum of 300 seconds
import { generateInsightsForSurveyResponsesConcept } from "@/app/api/(internal)/insights/lib/insights";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { headers } from "next/headers";
import { z } from "zod";
import { CRON_SECRET } from "@formbricks/lib/constants";
import { generateInsightsEnabledForSurveyQuestions } from "./lib/utils";

export const maxDuration = 300; // This function can run for a maximum of 300 seconds

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

    await generateInsightsForSurveyResponsesConcept(data.survey);

    return responses.successResponse({ message: "Insights generated successfully" });
  } catch (error) {
    throw error;
  }
};
