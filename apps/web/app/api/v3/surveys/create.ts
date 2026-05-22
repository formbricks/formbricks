import "server-only";
import type { TSurveyCreateInput } from "@formbricks/types/surveys/types";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { createSurvey } from "@/lib/survey/service";
import { type TV3SurveyLanguageRequest, ensureV3WorkspaceLanguages } from "./languages";
import { prepareV3SurveyCreate } from "./prepare";
import { V3SurveyReferenceValidationError } from "./reference-validation";
import type { TV3CreateSurveyBody } from "./schemas";
import { V3SurveyWritePermissionError, assertV3SurveyWritePermissions } from "./write-permissions";

export { V3SurveyWritePermissionError as V3SurveyCreatePermissionError };

function getCreatedBy(authentication: TV3Authentication): string | null {
  if (authentication && "user" in authentication && authentication.user?.id) {
    return authentication.user.id;
  }

  return null;
}

export async function executeV3SurveyCreate(params: {
  input: TV3CreateSurveyBody;
  authentication: TV3Authentication;
  languageRequests: TV3SurveyLanguageRequest[];
  requestId?: string;
}) {
  const { input, authentication, languageRequests, requestId } = params;
  const languages = await ensureV3WorkspaceLanguages(input.workspaceId, languageRequests, requestId);
  const surveyCreateInput: TSurveyCreateInput = {
    name: input.name,
    type: "link",
    status: input.status,
    metadata: input.metadata,
    welcomeCard: input.welcomeCard,
    blocks: input.blocks,
    endings: input.endings,
    hiddenFields: input.hiddenFields,
    variables: input.variables,
    languages,
    questions: [],
    createdBy: getCreatedBy(authentication),
  };

  return await createSurvey(input.workspaceId, surveyCreateInput);
}

export async function createV3Survey(
  input: TV3CreateSurveyBody,
  authentication: TV3Authentication,
  requestId?: string,
  organizationId?: string
) {
  const preparation = prepareV3SurveyCreate(input);
  if (!preparation.ok) {
    throw new V3SurveyReferenceValidationError(preparation.validation.invalidParams);
  }

  await assertV3SurveyWritePermissions(input, organizationId);

  return await executeV3SurveyCreate({
    input: preparation.document,
    authentication,
    languageRequests: preparation.languageRequests,
    requestId,
  });
}
