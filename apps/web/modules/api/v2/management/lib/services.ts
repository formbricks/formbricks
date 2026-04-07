"use server";

import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { err, ok } from "@formbricks/types/error-handlers";

export const fetchWorkspaceId = reactCache(async (id: string, isResponseId: boolean) => {
  try {
    const result = await prisma.survey.findFirst({
      where: isResponseId ? { responses: { some: { id } } } : { id },
      select: {
        workspaceId: true,
        environmentId: true,
      },
    });

    if (!result) {
      return err({
        type: "not_found",
        details: [{ field: isResponseId ? "response" : "survey", issue: "not found" }],
      });
    }

    return ok({ workspaceId: result.workspaceId, environmentId: result.environmentId });
  } catch (error) {
    return err({
      type: "internal_server_error",
      details: [
        {
          field: isResponseId ? "response" : "survey",
          issue: error instanceof Error ? error.message : "Unknown error occurred",
        },
      ],
    });
  }
});

export const fetchWorkspaceIdFromSurveyIds = reactCache(async (surveyIds: string[]) => {
  try {
    const results = await prisma.survey.findMany({
      where: { id: { in: surveyIds } },
      select: {
        workspaceId: true,
      },
    });

    if (results.length !== surveyIds.length) {
      return err({
        type: "not_found",
        details: [{ field: "survey", issue: "not found" }],
      });
    }

    return ok(results.map((result) => result.workspaceId));
  } catch (error) {
    return err({
      type: "internal_server_error",
      details: [
        { field: "survey", issue: error instanceof Error ? error.message : "Unknown error occurred" },
      ],
    });
  }
});
