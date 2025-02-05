import { Survey } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { surveyCache } from "@formbricks/lib/survey/cache";

export const getSurveyQuestions = reactCache(
  async (surveyId: string): Promise<Pick<Survey, "questions" | "environmentId">> =>
    cache(
      async () => {
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
          throw new Error("Survey not found");
        }

        return survey;
      },
      [`management-getSurveyQuestions-${surveyId}`],
      {
        tags: [surveyCache.tag.byId(surveyId)],
      }
    )()
);
