import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { err, ok } from "@formbricks/types/error-handlers";

export const getSurvey = reactCache(async (surveyId: string) => {
  try {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      select: {
        id: true,
        type: true,
      },
    });

    if (!survey) {
      return err({ type: "not_found", details: [{ field: "survey", issue: "not found" }] });
    }

    return ok(survey);
  } catch (error) {
    return err({ type: "internal_server_error", details: [{ field: "survey", issue: error.message }] });
  }
});
