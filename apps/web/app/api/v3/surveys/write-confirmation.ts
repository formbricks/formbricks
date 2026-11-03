import "server-only";
import { prisma } from "@formbricks/database";
import { problemConfirmationRequired } from "@/app/api/v3/lib/response";
import { getTranslate } from "@/lingodotdev/server";

/**
 * MCP confirmation on surveys with responses (ENG-6930, P13).
 *
 * An AI agent editing a survey people already answered can mix old and new responses in the summary,
 * or delete them. The editor warns a person before that; an agent gets the same warning as a refusal,
 * so it asks the user before it retries with `confirm: true`. Only the MCP tools ask for this — the
 * v3 HTTP API is unchanged — so an operation enforces it only when its caller passes the option.
 */
export type TV3SurveyWriteConfirmation = {
  /** The tool call's `confirm` argument: true once the user agreed. */
  confirmed: boolean;
};

/** Drafts never need it; anything else does once a single response exists. */
async function surveyHasResponsesToProtect(survey: { id: string; status: string }): Promise<boolean> {
  if (survey.status === "draft") {
    return false;
  }

  // One row answers the question, so `findFirst` rather than a count over every response.
  const response = await prisma.response.findFirst({
    where: { surveyId: survey.id },
    select: { id: true },
  });
  return response !== null;
}

/**
 * The refusal to return instead of writing, or `null` to go ahead.
 *
 * The message is the editor's own caution text (en-US, like every MCP message), followed by what the
 * agent has to do next.
 */
export async function getV3SurveyWriteConfirmationRefusal(
  survey: { id: string; status: string },
  confirmation: TV3SurveyWriteConfirmation | undefined,
  { action, requestId, instance }: { action: "change" | "delete"; requestId: string; instance: string }
): Promise<Response | null> {
  if (!confirmation || confirmation.confirmed || !(await surveyHasResponsesToProtect(survey))) {
    return null;
  }

  const t = await getTranslate("en-US");
  const caution =
    action === "delete"
      ? t("workspace.surveys.delete_survey_and_responses_warning")
      : `${t("workspace.surveys.edit.caution_text")}. ${t("workspace.surveys.edit.caution_recommendation")}`;

  return problemConfirmationRequired(
    requestId,
    `This survey has responses. ${caution} Pass confirm: true after the user agrees.`,
    instance
  );
}
