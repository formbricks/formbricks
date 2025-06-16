"use server";

import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { err, ok } from "@formbricks/types/error-handlers";

export const fetchEnvironmentId = reactCache(async (id: string, isResponseId: boolean) => {
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
});

export const fetchEnvironmentIdFromSurveyIds = reactCache(async (surveyIds: string[]) => {
  try {
    const results = await prisma.survey.findMany({
      where: { id: { in: surveyIds } },
      select: {
        environmentId: true,
      },
    });

    if (results.length !== surveyIds.length) {
      return err({
        type: "not_found",
        details: [{ field: "survey", issue: "not found" }],
      });
    }

    return ok(results.map((result) => result.environmentId));
  } catch (error) {
    return err({
      type: "internal_server_error",
      details: [{ field: "survey", issue: error.message }],
    });
  }
});
