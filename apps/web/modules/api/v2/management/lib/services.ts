"use server";

import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { responseCache } from "@formbricks/lib/response/cache";
import { responseNoteCache } from "@formbricks/lib/responseNote/cache";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const fetchEnvironmentId = reactCache(async (id: string, isResponseId: boolean) =>
  cache(
    async (): Promise<Result<{ environmentId: string }, ApiErrorResponseV2>> => {
      try {
        const result = await prisma.survey.findFirst({
          where: isResponseId ? { responses: { some: { id } } } : { id },
          select: {
            environmentId: true,
          },
        });

        if (!result) {
          return err({
            type: "not_found",
            details: [{ field: isResponseId ? "response" : "survey", issue: "not found" }],
          });
        }

        return ok({ environmentId: result.environmentId });
      } catch (error) {
        return err({
          type: "internal_server_error",
          details: [{ field: isResponseId ? "response" : "survey", issue: error.message }],
        });
      }
    },
    [`services-getEnvironmentId-${id}-${isResponseId}`],
    {
      tags: [responseCache.tag.byId(id), responseNoteCache.tag.byResponseId(id), surveyCache.tag.byId(id)],
    }
  )()
);
