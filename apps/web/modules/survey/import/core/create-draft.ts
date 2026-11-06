import "server-only";
import type { TSurvey } from "@formbricks/types/surveys/types";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { createV3Survey } from "@/app/api/v3/surveys/create";
import { getSessionUserId } from "@/app/api/v3/surveys/lib/operations";
import { ZV3CreateSurveyBody, formatV3ZodInvalidParams } from "@/app/api/v3/surveys/schemas";
import { SurveyImportInputError, nameFromSurvey } from "./errors";
import { getImportedSurveyName, getImporterTranslate } from "./imported-survey-name";
import { assertSurveyWithinDraftSize, findSurveyContentPastLimits } from "./survey-limits";

/**
 * Create the survey a reviewed import became when its file carried nothing outside the survey — a
 * Qualtrics export, or a Word, Excel, CSV or Markdown questionnaire (ENG-6846): the draft the dialog sends back
 * to `POST /api/internal/surveys/imports`. A Formbricks file, which brings references, is created by
 * `createSurveyFromFormbricksFile` instead.
 *
 * The draft is named again against the workspace as it is now — "<name> (imported N)" with the lowest
 * free N, which another import may have taken since the review — and created as a draft, whatever
 * status the client sent, through the v3 create and its checks.
 *
 * @throws SurveyImportFileTooLargeError — a 413: the draft weighs more than any import builds.
 * @throws SurveyImportInputError — a 422 naming each field the create body refuses, or a question or
 *   text past the import's caps, nothing created.
 * @throws whatever the v3 create throws, mapped by its caller like `POST /api/v3/surveys`.
 * @throws SurveyWriteAfterCommitError — the survey was created, but the work after its commit failed.
 */
export const createSurveyFromImportDraft = async ({
  survey,
  workspaceId,
  organizationId,
  authentication,
  requestId,
}: {
  survey: Record<string, unknown>;
  workspaceId: string;
  organizationId: string;
  authentication: TV3Authentication;
  requestId: string;
}): Promise<TSurvey> => {
  // The client sends the draft back, so it is held to what any import may create before anything
  // reads it: the lookup below takes its name, and the parse is where a large survey costs.
  assertSurveyWithinDraftSize(survey, null);
  const pastLimits = findSurveyContentPastLimits(survey, null);
  if (pastLimits.length > 0) throw new SurveyImportInputError(pastLimits, "The survey is not valid.");

  const t = await getImporterTranslate(getSessionUserId(authentication));
  const sourceName = typeof survey.name === "string" ? survey.name : "";
  const name = await getImportedSurveyName(workspaceId, sourceName, t);

  const parsed = ZV3CreateSurveyBody.safeParse({ ...survey, workspaceId, name, status: "draft" });
  if (!parsed.success) {
    throw new SurveyImportInputError(
      nameFromSurvey(formatV3ZodInvalidParams(parsed.error, "data"), null),
      "The survey is not valid."
    );
  }

  // No transaction of its own: the create commits by itself and throws `SurveyWriteAfterCommitError`
  // when only the work after its commit failed. Holding one here would hold a pool connection through
  // the create's checks, which read through another.
  return createV3Survey(parsed.data, authentication, requestId, organizationId);
};
