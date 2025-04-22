import { cache } from "@/lib/cache";
import { responseCache } from "@/lib/response/cache";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { Response } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const getResponse = reactCache(async (contactId: string, surveyId: string) =>
  cache(
    async (): Promise<Result<Pick<Response, "id">, ApiErrorResponseV2>> => {
      try {
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
          return err({ type: "not_found", details: [{ field: "response", issue: "not found" }] });
        }

        return ok(response);
      } catch (error) {
        return err({ type: "internal_server_error", details: [{ field: "response", issue: error.message }] });
      }
    },
    [`contact-link-getResponse-${contactId}-${surveyId}`],
    {
      tags: [responseCache.tag.byId(contactId), responseCache.tag.bySurveyId(surveyId)],
    }
  )()
);
