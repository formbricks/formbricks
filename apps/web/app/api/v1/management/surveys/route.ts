import { z } from "zod";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { ZSurveyCreateInputWithEnvironmentId } from "@formbricks/types/surveys/types";
import { checkFeaturePermissions } from "@/app/api/v1/management/surveys/lib/utils";
import { responses } from "@/app/lib/api/response";
import {
  transformBlocksToQuestions,
  transformQuestionsToBlocks,
  validateSurveyInput,
} from "@/app/lib/api/survey-transformation";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { createLanguage } from "@/lib/language/service";
import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import { getProject } from "@/lib/project/service";
import { createSurvey } from "@/lib/survey/service";
import { getProjectIdFromEnvironmentId } from "@/lib/utils/helper";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { resolveStorageUrlsInObject } from "@/modules/storage/utils";
import { getSurveys } from "./lib/surveys";

const ZImportedSurveyLanguage = z.object({
  code: z.string().min(1),
  enabled: z.boolean(),
  default: z.boolean(),
});

const ZImportedSurveyLanguages = z.array(ZImportedSurveyLanguage);

const mapImportedLanguagesToSurveyLanguages = async (
  importedLanguages: z.infer<typeof ZImportedSurveyLanguages>,
  environmentId: string
) => {
  const projectId = await getProjectIdFromEnvironmentId(environmentId);
  const uniqueImportedLanguageCodes = [...new Set(importedLanguages.map((language) => language.code))];
  let project = await getProject(projectId);
  const existingLanguageCodes = new Set(project?.languages.map((language) => language.code) ?? []);
  const missingLanguageCodes = uniqueImportedLanguageCodes.filter((code) => !existingLanguageCodes.has(code));

  if (missingLanguageCodes.length > 0) {
    for (const code of missingLanguageCodes) {
      try {
        await createLanguage(projectId, { code, alias: null });
      } catch {}
    }
    project = await getProject(projectId);
  }

  const languagesByCode = new Map((project?.languages ?? []).map((language) => [language.code, language]));
  const unresolvedLanguageCodes = uniqueImportedLanguageCodes.filter((code) => !languagesByCode.has(code));
  if (unresolvedLanguageCodes.length > 0) {
    return {
      error: `Import could not auto-create these project languages: ${unresolvedLanguageCodes.join(
        ", "
      )}. Please add them in Project Configuration and try again.`,
    };
  }

  return {
    data: importedLanguages.map((language) => ({
      language: languagesByCode.get(language.code)!,
      enabled: language.enabled,
      default: language.default,
    })),
  };
};

const normalizeSurveyInputForImport = async (
  surveyInput: unknown
): Promise<{ data: z.infer<typeof ZSurveyCreateInputWithEnvironmentId> } | { response: Response }> => {
  const inputValidation = ZSurveyCreateInputWithEnvironmentId.safeParse(surveyInput);
  if (inputValidation.success) {
    return { data: inputValidation.data };
  }

  const importedLanguagesValidation = z
    .object({
      environmentId: z.string(),
      languages: ZImportedSurveyLanguages,
    })
    .safeParse(surveyInput);

  if (!importedLanguagesValidation.success) {
    return {
      response: responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      ),
    };
  }

  const languageMappingResult = await mapImportedLanguagesToSurveyLanguages(
    importedLanguagesValidation.data.languages,
    importedLanguagesValidation.data.environmentId
  );
  if ("error" in languageMappingResult) {
    return {
      response: responses.badRequestResponse(languageMappingResult.error),
    };
  }

  const normalizedInput = {
    ...(surveyInput as Record<string, unknown>),
    languages: languageMappingResult.data,
  };
  const normalizedInputValidation = ZSurveyCreateInputWithEnvironmentId.safeParse(normalizedInput);
  if (!normalizedInputValidation.success) {
    return {
      response: responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(normalizedInputValidation.error),
        true
      ),
    };
  }

  return { data: normalizedInputValidation.data };
};

export const GET = withV1ApiWrapper({
  handler: async ({ req, authentication }) => {
    if (!authentication || !("apiKeyId" in authentication)) {
      return { response: responses.notAuthenticatedResponse() };
    }

    try {
      const searchParams = new URL(req.url).searchParams;
      const limit = searchParams.has("limit") ? Number(searchParams.get("limit")) : undefined;
      const offset = searchParams.has("offset") ? Number(searchParams.get("offset")) : undefined;

      const environmentIds = authentication.environmentPermissions.map(
        (permission) => permission.environmentId
      );

      const surveys = await getSurveys(environmentIds, limit, offset);

      const surveysWithQuestions = surveys.map((survey) => {
        // If the survey has blocks and each block has ONLY ONE element, we can transform the blocks to questions
        // This is only for backwards compatibility with the older surveys
        const shouldTransformToQuestions =
          survey.blocks &&
          survey.blocks.length > 0 &&
          survey.blocks.every((block) => block.elements.length === 1);

        if (shouldTransformToQuestions) {
          return {
            ...survey,
            questions: transformBlocksToQuestions(survey.blocks, survey.endings),
            blocks: [],
          };
        }

        return survey;
      });

      return {
        response: responses.successResponse(resolveStorageUrlsInObject(surveysWithQuestions)),
      };
    } catch (error) {
      if (error instanceof DatabaseError) {
        return {
          response: responses.badRequestResponse(error.message),
        };
      }
      throw error;
    }
  },
});

export const POST = withV1ApiWrapper({
  handler: async ({ req, auditLog, authentication }) => {
    if (!authentication || !("apiKeyId" in authentication)) {
      return { response: responses.notAuthenticatedResponse() };
    }

    try {
      let surveyInput;
      try {
        surveyInput = await req.json();
      } catch (error) {
        logger.error({ error, url: req.url }, "Error parsing JSON");
        return {
          response: responses.badRequestResponse("Malformed JSON input, please check your request body"),
        };
      }

      const normalizedInputResult = await normalizeSurveyInputForImport(surveyInput);
      if ("response" in normalizedInputResult) {
        return normalizedInputResult;
      }

      const { environmentId } = normalizedInputResult.data;

      if (!hasPermission(authentication.environmentPermissions, environmentId, "POST")) {
        return {
          response: responses.unauthorizedResponse(),
        };
      }

      const organization = await getOrganizationByEnvironmentId(environmentId);
      if (!organization) {
        return {
          response: responses.notFoundResponse("Organization", null),
        };
      }

      const surveyData = { ...normalizedInputResult.data, environmentId };

      const validateResult = validateSurveyInput(surveyData);
      if (!validateResult.ok) {
        return {
          response: responses.badRequestResponse(validateResult.error.message),
        };
      }

      const { hasQuestions } = validateResult.data;

      if (hasQuestions) {
        surveyData.blocks = transformQuestionsToBlocks(surveyData.questions, surveyData.endings || []);
        surveyData.questions = [];
      }

      const featureCheckResult = await checkFeaturePermissions(surveyData, organization);
      if (featureCheckResult) {
        return {
          response: featureCheckResult,
        };
      }

      const survey = await createSurvey(environmentId, { ...surveyData, environmentId: undefined });
      if (auditLog) {
        auditLog.targetId = survey.id;
        auditLog.newObject = survey;
      }

      if (hasQuestions) {
        const surveyWithQuestions = {
          ...survey,
          questions: transformBlocksToQuestions(survey.blocks, survey.endings),
          blocks: [],
        };

        return {
          response: responses.successResponse(surveyWithQuestions),
        };
      }

      return {
        response: responses.successResponse(survey),
      };
    } catch (error) {
      if (error instanceof DatabaseError) {
        return {
          response: responses.internalServerErrorResponse(error.message),
        };
      }
      throw error;
    }
  },
  action: "created",
  targetType: "survey",
});
