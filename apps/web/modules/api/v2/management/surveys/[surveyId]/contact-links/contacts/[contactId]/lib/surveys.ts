import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { surveyCache } from "@formbricks/lib/survey/cache";

export const getSurvey = reactCache(async (surveyId: string) =>
  cache(
    async () => {
      const survey = await prisma.survey.findUnique({
        where: { id: surveyId },
        select: {
          id: true,
          type: true,
        },
      });

      if (!survey) {
        return null;
      }

      return survey;
    },
    [`contact-link-getSurvey-${surveyId}`],
    {
      tags: [surveyCache.tag.byId(surveyId)],
    }
  )()
);
