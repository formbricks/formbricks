import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { llmModel } from "@formbricks/lib/aiModels";
import { TSurveyQuestion } from "@formbricks/types/surveys/types";

export const getInsightsEnabled = async (question: TSurveyQuestion): Promise<boolean> => {
  try {
    const { object } = await generateObject({
      model: llmModel,
      schema: z.object({
        insightsEnabled: z.boolean(),
      }),
      prompt: `We extract insights (e.g. feature requests, complaints, other) from survey questions. Can we find them in this question?: ${question.headline.default}`,
      experimental_telemetry: { isEnabled: true },
    });

    return object.insightsEnabled;
  } catch (error) {
    throw error;
  }
};
