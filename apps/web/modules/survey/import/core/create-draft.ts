import "server-only";
import type { TSurvey } from "@formbricks/types/surveys/types";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { createV3Survey } from "@/app/api/v3/surveys/create";
import { getSessionUserId } from "@/app/api/v3/surveys/lib/operations";
import { ZV3CreateSurveyBody, formatV3ZodInvalidParams } from "@/app/api/v3/surveys/schemas";
import { SurveyImportInputError, nameFromSurvey } from "./errors";
import { getImportedSurveyName, getImporterTranslate } from "./imported-survey-name";

/**
 * Create the survey a reviewed import became when its file carried nothing outside the survey — a
 * Qualtrics export, or a Word, Excel or CSV questionnaire (ENG-6846): the draft the dialog sends back
 * to `POST /api/internal/surveys/imports`. A Formbricks file, which brings references, is created by
 * `createSurveyFromFormbricksFile` instead.
 *
 * The draft is named again against the workspace as it is now — "<name> (imported N)" with the lowest
 * free N, which another import may have taken since the review — and created as a draft, whatever
 * status the client sent, through the v3 create and its checks.
 *
 * @throws SurveyImportInputError — a 422 naming each field the create body refuses, nothing created.
 * @throws whatever the v3 create throws, mapped by its caller like `POST /api/v3/surveys`.
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

  return createV3Survey(parsed.data, authentication, requestId, organizationId);
};
