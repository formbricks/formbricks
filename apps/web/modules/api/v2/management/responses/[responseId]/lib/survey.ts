import { ApiErrorResponse } from "@/modules/api/v2/types/api-error";
import { Survey } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const getSurveyQuestions = reactCache(async (surveyId: string) =>
  cache(
    async (): Promise<Result<Pick<Survey, "questions" | "environmentId">, ApiErrorResponse>> => {
      try {
        const survey = await prisma.survey.findUnique({
          where: {
            id: surveyId,
          },
          select: {
            environmentId: true,
            questions: true,
          },
        });

        if (!survey) {
          return err({ type: "not_found", details: [{ field: "survey", issue: "not found" }] });
        }

        return ok(survey);
      } catch (error) {
        return err({ type: "internal_server_error", details: [{ field: "survey", issue: error.message }] });
      }
    },
    [`management-getSurveyQuestions-${surveyId}`],
    {
      tags: [surveyCache.tag.byId(surveyId)],
    }
  )()
);
