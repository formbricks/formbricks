"use server";

import { ApiErrorResponse } from "@/modules/api/types/api-error";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { responseCache } from "@formbricks/lib/response/cache";
import { responseNoteCache } from "@formbricks/lib/responseNote/cache";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const getSurveyEnvironmentId = reactCache(async (surveyId: string) =>
  cache(
    async (): Promise<Result<{ environmentId: string }, ApiErrorResponse>> => {
      try {
        const survey = await prisma.survey.findUnique({
          where: {
            id: surveyId,
          },
          select: {
            environmentId: true,
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
    [`services-getSurvey-${surveyId}`],
    {
      tags: [surveyCache.tag.byId(surveyId)],
    }
  )()
);

export const getResponseSurveyId = reactCache(async (responseId: string) =>
  cache(
    async (): Promise<Result<{ surveyId: string }, ApiErrorResponse>> => {
      try {
        const response = await prisma.response.findUnique({
          where: {
            id: responseId,
          },
          select: { surveyId: true },
        });

        if (!response) {
          return err({ type: "not_found", details: [{ field: "response", issue: "not found" }] });
        }

        return ok(response);
      } catch (error) {
        return err({ type: "internal_server_error", details: [{ field: "response", issue: error.message }] });
      }
    },
    [`services-getResponse-${responseId}`],
    {
      tags: [responseCache.tag.byId(responseId), responseNoteCache.tag.byResponseId(responseId)],
    }
  )()
);
