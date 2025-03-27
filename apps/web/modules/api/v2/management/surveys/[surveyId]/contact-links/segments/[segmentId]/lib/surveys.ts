import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { Survey } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const getSurvey = reactCache(async (surveyId: string) =>
  cache(
    async (): Promise<
      Result<Pick<Survey, "id" | "environmentId" | "type" | "status">, ApiErrorResponseV2>
    > => {
      try {
        const survey = await prisma.survey.findUnique({
          where: { id: surveyId },
          select: {
            id: true,
            environmentId: true,
            type: true,
            status: true,
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
    [`contact-link-getSurvey-${surveyId}`],
    {
      tags: [surveyCache.tag.byId(surveyId)],
    }
  )()
);
