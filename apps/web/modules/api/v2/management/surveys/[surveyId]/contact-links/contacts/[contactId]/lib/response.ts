import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { responseCache } from "@formbricks/lib/response/cache";

export const getResponse = reactCache(async (contactId: string, surveyId: string) =>
  cache(
    async () => {
      const response = await prisma.response.findFirst({
        where: {
          contactId,
          surveyId,
        },
        select: {
          id: true,
        },
      });

      if (!response) {
        return null;
      }

      return response;
    },
    [`contact-link-getResponse-${contactId}-${surveyId}`],
    {
      tags: [responseCache.tag.byId(contactId), responseCache.tag.bySurveyId(surveyId)],
    }
  )()
);
