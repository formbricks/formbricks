import "server-only";
import { prisma } from "@formbricks/database";
import { getIngestedStorageKeys } from "@formbricks/types/embedded-data-fields";
import { LINK_SURVEY_SYSTEM_PARAM_KEYS } from "@formbricks/types/surveys/link-survey-params";
import type { SurveyLinkSurveyCheck } from "@formbricks/workflows/server";
import { inlineSurveyEmbeddedFields, selectSurveyEmbeddedDataLinks } from "@/lib/embedded-data/survey-fields";

/**
 * The surveys `send_email` steps link to (ENG-7180), checked the same way by enable, the dry run and
 * the runner: each must be a link survey in the workflow's workspace, and its link only takes the
 * survey's passed-in Embedded Data fields, by storage key (what `getHiddenFieldsFromSearchParams`
 * reads). A field named like a parameter the link survey reads for itself (`lang`, `userId`, …) can
 * never be filled from the URL, so it is not offered, which also keeps a link from setting one.
 */
export const getWorkflowSurveyLinkSurveys = async ({
  workspaceId,
  surveyIds,
}: {
  workspaceId: string;
  surveyIds: string[];
}): Promise<SurveyLinkSurveyCheck[]> => {
  if (surveyIds.length === 0) return [];
  const surveys = await prisma.survey.findMany({
    where: { id: { in: surveyIds }, workspaceId },
    select: { id: true, type: true, embeddedDataLinks: selectSurveyEmbeddedDataLinks },
  });
  const surveyById = new Map(surveys.map((survey) => [survey.id, survey]));

  return surveyIds.map((surveyId): SurveyLinkSurveyCheck => {
    const survey = surveyById.get(surveyId);
    if (!survey) return { surveyId, status: "not_found", acceptedEmbeddedDataKeys: [] };
    if (survey.type !== "link") return { surveyId, status: "not_link", acceptedEmbeddedDataKeys: [] };
    const keys = getIngestedStorageKeys({ embeddedFields: inlineSurveyEmbeddedFields(survey) });
    return {
      surveyId,
      status: "ok",
      acceptedEmbeddedDataKeys: keys.filter((key) => !LINK_SURVEY_SYSTEM_PARAM_KEYS.has(key)),
    };
  });
};
