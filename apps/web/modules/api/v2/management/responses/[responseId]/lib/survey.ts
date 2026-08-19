import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { err, ok } from "@formbricks/types/error-handlers";

export const getSurveyQuestions = reactCache(async (surveyId: string) => {
  try {
    const survey = await prisma.survey.findUnique({
      where: {
        id: surveyId,
      },
      select: {
        questions: true,
        blocks: true,
        workspaceId: true,
        // Not a question, like `workspaceId` above: the response routes need the survey's
        // "Anonymize responses" setting to suppress the sensitive `meta` a management caller may have
        // sent, and this is the survey read they already make. One more column on an existing
        // `reactCache`d query rather than a second round trip per response.
        isAnonymizeResponsesEnabled: true,
      },
    });

    if (!survey) {
      return err({ type: "not_found", details: [{ field: "survey", issue: "not found" }] });
    }

    return ok(survey);
  } catch (error) {
    return err({
      type: "internal_server_error",
      details: [
        { field: "survey", issue: error instanceof Error ? error.message : "Unknown error occurred" },
      ],
    });
  }
});
