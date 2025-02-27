"use server";

import { ApiErrorResponse } from "@/modules/api/v2/types/api-error";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { responseCache } from "@formbricks/lib/response/cache";
import { responseNoteCache } from "@formbricks/lib/responseNote/cache";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const getSurveyAndEnvironmentId = reactCache(async (id: string, isResponseId: boolean) =>
  cache(
    async (): Promise<Result<{ surveyId: string; environmentId: string }, ApiErrorResponse>> => {
      try {
        const result = await prisma.survey.findFirst({
          where: isResponseId ? { responses: { some: { id } } } : { id },
          select: {
            id: !isResponseId,
            environmentId: true,
            responses: isResponseId ? { where: { id }, select: { surveyId: true } } : false,
          },
        });

        if (!result) {
          return err({
            type: "not_found",
            details: [{ field: isResponseId ? "response" : "survey", issue: "not found" }],
          });
        }

        if (isResponseId && result.responses && result.responses.length > 0) {
          return ok({ surveyId: result.responses[0].surveyId, environmentId: result.environmentId });
        } else if (!isResponseId) {
          return ok({ surveyId: id, environmentId: result.environmentId });
        } else {
          return err({ type: "not_found", details: [{ field: "response", issue: "not found" }] });
        }
      } catch (error) {
        return err({
          type: "internal_server_error",
          details: [{ field: isResponseId ? "response" : "survey", issue: error.message }],
        });
      }
    },
    [`services-getSurveyAndEnvironmentId-${id}-${isResponseId}`],
    {
      tags: [responseCache.tag.byId(id), responseNoteCache.tag.byResponseId(id), surveyCache.tag.byId(id)],
    }
  )()
);
