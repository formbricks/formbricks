import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { selectSurvey } from "@/lib/survey/service";
import { stripIsDraftFromBlocks, transformPrismaSurvey } from "@/lib/survey/utils";
import {
  isSurveySchedulingDue,
  normalizeSurveyScheduling,
  reconcileDueSurveySchedules,
} from "@/modules/survey/scheduling/lib/survey-scheduling";
import { type TV3SurveyLanguageRequest, ensureV3WorkspaceLanguages } from "./languages";
import { prepareV3SurveyPatchInput } from "./prepare";
import { V3SurveyReferenceValidationError } from "./reference-validation";
import type { TV3SurveyDocument } from "./schemas";
import { assertV3SurveyWritePermissions } from "./write-permissions";

function buildSurveyLanguageUpdate(
  currentSurvey: TSurvey,
  languages: TSurvey["languages"]
): Prisma.SurveyUpdateInput["languages"] {
  const currentLanguageIds = currentSurvey.languages.map((surveyLanguage) => surveyLanguage.language.id);
  const updatedLanguageIds = languages.map((surveyLanguage) => surveyLanguage.language.id);
  const enabledLanguageIds = new Set(
    languages
      .filter((surveyLanguage) => surveyLanguage.enabled)
      .map((surveyLanguage) => surveyLanguage.language.id)
  );
  const defaultLanguageId = languages.find((surveyLanguage) => surveyLanguage.default)?.language.id;

  const languagesToAdd = updatedLanguageIds.filter((languageId) => !currentLanguageIds.includes(languageId));
  const languagesToRemove = currentLanguageIds.filter(
    (languageId) => !updatedLanguageIds.includes(languageId)
  );

  return {
    updateMany: currentLanguageIds.map((languageId) => ({
      where: {
        languageId,
      },
      data: {
        default: languageId === defaultLanguageId,
        enabled: enabledLanguageIds.has(languageId),
      },
    })),
    ...(languagesToAdd.length > 0
      ? {
          create: languagesToAdd.map((languageId) => ({
            languageId,
            default: languageId === defaultLanguageId,
            enabled: enabledLanguageIds.has(languageId),
          })),
        }
      : {}),
    ...(languagesToRemove.length > 0
      ? {
          deleteMany: languagesToRemove.map((languageId) => ({
            languageId,
          })),
        }
      : {}),
  };
}

async function reconcilePersistedV3SurveyPatch({
  survey,
  workspaceId,
}: {
  survey: TSurvey;
  workspaceId: string;
}): Promise<TSurvey> {
  if (!isSurveySchedulingDue(survey)) {
    return survey;
  }

  const reconciliationResult = await reconcileDueSurveySchedules({
    logContext: {
      source: "v3-survey-patch",
      surveyId: survey.id,
      workspaceId,
    },
    surveyId: survey.id,
  });

  if (!reconciliationResult.surveyUpdated) {
    return survey;
  }

  const reconciledSurvey = await prisma.survey.findUnique({
    where: { id: survey.id },
    select: selectSurvey,
  });

  if (!reconciledSurvey) {
    throw new ResourceNotFoundError("Survey", survey.id);
  }

  return transformPrismaSurvey<TSurvey>(reconciledSurvey);
}

export async function executeV3SurveyPatch(params: {
  currentSurvey: TSurvey;
  document: TV3SurveyDocument;
  languageRequests: TV3SurveyLanguageRequest[];
  requestId?: string;
}): Promise<TSurvey> {
  const { currentSurvey, document, languageRequests, requestId } = params;
  const languages = await ensureV3WorkspaceLanguages(currentSurvey.workspaceId, languageRequests, requestId);
  const normalizedScheduling = normalizeSurveyScheduling({
    currentStatus: currentSurvey.status,
    closeOn: currentSurvey.closeOn,
    publishOn: currentSurvey.publishOn,
    status: document.status,
  });

  try {
    const persistedSurvey = await prisma.survey.update({
      where: { id: currentSurvey.id },
      data: {
        name: document.name,
        status: document.status,
        metadata: document.metadata,
        welcomeCard: document.welcomeCard,
        blocks: stripIsDraftFromBlocks(document.blocks),
        endings: document.endings,
        hiddenFields: document.hiddenFields,
        variables: document.variables,
        closeOn: normalizedScheduling.closeOn,
        publishOn: normalizedScheduling.publishOn,
        languages: buildSurveyLanguageUpdate(currentSurvey, languages),
      },
      select: selectSurvey,
    });

    return await reconcilePersistedV3SurveyPatch({
      survey: transformPrismaSurvey<TSurvey>(persistedSurvey),
      workspaceId: currentSurvey.workspaceId,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
}

export async function patchV3Survey(
  currentSurvey: TSurvey,
  input: unknown,
  requestId?: string,
  organizationId?: string
): Promise<TSurvey> {
  const preparation = prepareV3SurveyPatchInput(currentSurvey, input);
  if (!preparation.ok) {
    throw new V3SurveyReferenceValidationError(preparation.validation.invalidParams);
  }

  await assertV3SurveyWritePermissions(
    {
      workspaceId: currentSurvey.workspaceId,
      blocks: preparation.document.blocks,
      endings: preparation.document.endings,
      previous: {
        blocks: currentSurvey.blocks,
        endings: currentSurvey.endings,
      },
    },
    organizationId
  );

  return await executeV3SurveyPatch({
    currentSurvey,
    document: preparation.document,
    languageRequests: preparation.languageRequests,
    requestId,
  });
}
