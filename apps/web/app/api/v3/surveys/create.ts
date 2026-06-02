import "server-only";
import type { TSurveyCreateInput } from "@formbricks/types/surveys/types";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getOrganizationByWorkspaceId } from "@/lib/organization/service";
import { createSurvey } from "@/lib/survey/service";
import { getElementsFromBlocks } from "@/lib/survey/utils";
import { getExternalUrlsPermission } from "@/modules/survey/lib/permission";
import { type TV3SurveyLanguageRequest, ensureV3WorkspaceLanguages } from "./languages";
import { prepareV3SurveyCreate } from "./prepare";
import { V3SurveyReferenceValidationError } from "./reference-validation";
import type { TV3CreateSurveyBody, TV3TrustedTemplateCreateSurveyBody } from "./schemas";

export class V3SurveyCreatePermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "V3SurveyCreatePermissionError";
  }
}

function getCreatedBy(authentication: TV3Authentication): string | null {
  if (authentication && "user" in authentication && authentication.user?.id) {
    return authentication.user.id;
  }

  return null;
}

type TV3SurveyCreateDocument = TV3CreateSurveyBody | TV3TrustedTemplateCreateSurveyBody;

function hasExternalUrlReferences(input: TV3SurveyCreateDocument): boolean {
  const hasExternalEndingLink = input.endings.some((ending) => {
    if (ending.type === "endScreen") {
      return Boolean(ending.buttonLink);
    }

    return Boolean(ending.url);
  });
  const hasExternalCtaButton = getElementsFromBlocks(input.blocks).some(
    (element) => element.type === "cta" && element.buttonExternal
  );

  return hasExternalEndingLink || hasExternalCtaButton;
}

async function assertV3SurveyCreatePermissions(
  input: TV3CreateSurveyDocument,
  organizationId?: string
): Promise<void> {
  if (!hasExternalUrlReferences(input)) {
    return;
  }

  const resolvedOrganizationId =
    organizationId ?? (await getOrganizationByWorkspaceId(input.workspaceId))?.id ?? null;
  if (!resolvedOrganizationId) {
    throw new V3SurveyCreatePermissionError(
      `Unable to verify external URL permissions for workspaceId '${input.workspaceId}'.`
    );
  }

  const isExternalUrlsAllowed = await getExternalUrlsPermission(resolvedOrganizationId);
  if (!isExternalUrlsAllowed) {
    throw new V3SurveyCreatePermissionError(
      "External URLs are not enabled for this organization. Upgrade to use external survey links."
    );
  }
}

export async function executeV3SurveyCreate(params: {
  input: TV3SurveyCreateDocument;
  authentication: TV3Authentication;
  languageRequests: TV3SurveyLanguageRequest[];
  requestId?: string;
}) {
  const { input, authentication, languageRequests, requestId } = params;
  const languages = await ensureV3WorkspaceLanguages(input.workspaceId, languageRequests, requestId);
  const surveyCreateInput: TSurveyCreateInput = {
    name: input.name,
    type: input.type,
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

  await assertV3SurveyCreatePermissions(input, organizationId);

  return await executeV3SurveyCreate({
    input: preparation.document,
    authentication,
    languageRequests: preparation.languageRequests,
    requestId,
  });
}

export async function createV3SurveyFromTrustedTemplate(
  input: TV3TrustedTemplateCreateSurveyBody,
  authentication: TV3Authentication,
  requestId?: string
) {
  const preparation = prepareV3SurveyCreate(input);
  if (!preparation.ok) {
    throw new V3SurveyReferenceValidationError(preparation.validation.invalidParams);
  }

  return await executeV3SurveyCreate({
    input: preparation.document,
    authentication,
    languageRequests: preparation.languageRequests,
    requestId,
  });
}
