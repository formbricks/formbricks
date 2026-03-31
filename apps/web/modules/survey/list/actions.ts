"use server";

import { createId } from "@paralleldrive/cuid2";
import { z } from "zod";
import { logger } from "@formbricks/logger";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { ZSurveyFilterCriteria } from "@formbricks/types/surveys/types";
import { env } from "@/lib/env";
import { createLanguage } from "@/lib/language/service";
import { getProject } from "@/lib/project/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import {
  getEnvironmentIdFromSurveyId,
  getOrganizationIdFromEnvironmentId,
  getOrganizationIdFromSurveyId,
  getProjectIdFromEnvironmentId,
  getProjectIdFromSurveyId,
} from "@/lib/utils/helper";
import { generateSurveySingleUseIds } from "@/lib/utils/single-use-surveys";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { getSurvey as getSurveyFull } from "@/modules/survey/lib/survey";
import { getProjectIdIfEnvironmentExists } from "@/modules/survey/list/lib/environment";
import { ZSurveyExportPayload, transformSurveyForExport } from "@/modules/survey/list/lib/export-survey";
import {
  type TSurveyLanguageConnection,
  addLanguageLabels,
  mapLanguages,
  mapTriggers,
  normalizeLanguagesForCreation,
  parseSurveyPayload,
  persistSurvey,
  resolveImportCapabilities,
} from "@/modules/survey/list/lib/import";
import {
  buildImportWarnings,
  detectImagesInSurvey,
  getLanguageNames,
  stripUnavailableFeatures,
} from "@/modules/survey/list/lib/import-helpers";
import { convertDocxToSurveyPayload } from "@/modules/survey/list/lib/import/llm-docx-converter";
import { resolveMissingProjectLanguages } from "@/modules/survey/list/lib/import/missing-language-resolution";
import { createRemoteSurveyFromPayload } from "@/modules/survey/list/lib/import/remote-survey-create";
import { getUserProjects } from "@/modules/survey/list/lib/project";
import {
  copySurveyToOtherEnvironment,
  deleteSurvey,
  getSurvey,
  getSurvey as getSurveyMinimal,
  getSurveys,
} from "@/modules/survey/list/lib/survey";

const ZGetSurveyAction = z.object({
  surveyId: z.cuid2(),
});

export const getSurveyAction = authenticatedActionClient
  .inputSchema(ZGetSurveyAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "read",
          projectId: await getProjectIdFromSurveyId(parsedInput.surveyId),
        },
      ],
    });

    return await getSurveyMinimal(parsedInput.surveyId);
  });

const ZExportSurveyAction = z.object({
  surveyId: z.string().cuid2(),
});

export const exportSurveyAction = authenticatedActionClient
  .schema(ZExportSurveyAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "read",
          projectId: await getProjectIdFromSurveyId(parsedInput.surveyId),
        },
      ],
    });

    const survey = await getSurveyFull(parsedInput.surveyId);

    return transformSurveyForExport(survey);
  });

const ZCopySurveyToOtherEnvironmentAction = z.object({
  surveyId: z.cuid2(),
  targetEnvironmentId: z.cuid2(),
});

export const copySurveyToOtherEnvironmentAction = authenticatedActionClient
  .inputSchema(ZCopySurveyToOtherEnvironmentAction)
  .action(
    withAuditLogging("copiedToOtherEnvironment", "survey", async ({ ctx, parsedInput }) => {
      const sourceEnvironmentId = await getEnvironmentIdFromSurveyId(parsedInput.surveyId);
      const sourceEnvironmentProjectId = await getProjectIdIfEnvironmentExists(sourceEnvironmentId);
      const targetEnvironmentProjectId = await getProjectIdIfEnvironmentExists(
        parsedInput.targetEnvironmentId
      );

      if (!sourceEnvironmentProjectId || !targetEnvironmentProjectId) {
        throw new ResourceNotFoundError(
          "Environment",
          sourceEnvironmentProjectId ? parsedInput.targetEnvironmentId : sourceEnvironmentId
        );
      }

      const sourceEnvironmentOrganizationId = await getOrganizationIdFromEnvironmentId(sourceEnvironmentId);
      const targetEnvironmentOrganizationId = await getOrganizationIdFromEnvironmentId(
        parsedInput.targetEnvironmentId
      );

      if (sourceEnvironmentOrganizationId !== targetEnvironmentOrganizationId) {
        throw new OperationNotAllowedError("Source and target environments must be in the same organization");
      }

      // authorization check for source environment
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId: sourceEnvironmentOrganizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "projectTeam",
            minPermission: "readWrite",
            projectId: sourceEnvironmentProjectId,
          },
        ],
      });

      // authorization check for target environment
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId: targetEnvironmentOrganizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "projectTeam",
            minPermission: "readWrite",
            projectId: targetEnvironmentProjectId,
          },
        ],
      });

      ctx.auditLoggingCtx.organizationId = sourceEnvironmentOrganizationId;
      ctx.auditLoggingCtx.surveyId = parsedInput.surveyId;
      const result = await copySurveyToOtherEnvironment(
        sourceEnvironmentId,
        parsedInput.surveyId,
        parsedInput.targetEnvironmentId,
        ctx.user.id
      );
      ctx.auditLoggingCtx.newObject = result;
      return result;
    })
  );

const ZGetProjectsByEnvironmentIdAction = z.object({
  environmentId: z.cuid2(),
});

export const getProjectsByEnvironmentIdAction = authenticatedActionClient
  .inputSchema(ZGetProjectsByEnvironmentIdAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromEnvironmentId(parsedInput.environmentId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "readWrite",
          projectId: await getProjectIdFromEnvironmentId(parsedInput.environmentId),
        },
      ],
    });

    return await getUserProjects(ctx.user.id, organizationId);
  });

const ZDeleteSurveyAction = z.object({
  surveyId: z.cuid2(),
});

export const deleteSurveyAction = authenticatedActionClient.inputSchema(ZDeleteSurveyAction).action(
  withAuditLogging("deleted", "survey", async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          projectId: await getProjectIdFromSurveyId(parsedInput.surveyId),
          minPermission: "readWrite",
        },
      ],
    });

    ctx.auditLoggingCtx.organizationId = await getOrganizationIdFromSurveyId(parsedInput.surveyId);
    ctx.auditLoggingCtx.surveyId = parsedInput.surveyId;
    ctx.auditLoggingCtx.oldObject = await getSurvey(parsedInput.surveyId);
    return await deleteSurvey(parsedInput.surveyId);
  })
);

const ZGenerateSingleUseIdAction = z.object({
  surveyId: z.cuid2(),
  isEncrypted: z.boolean(),
  count: z.number().min(1).max(5000).prefault(1),
});

export const generateSingleUseIdsAction = authenticatedActionClient
  .inputSchema(ZGenerateSingleUseIdAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          projectId: await getProjectIdFromSurveyId(parsedInput.surveyId),
          minPermission: "readWrite",
        },
      ],
    });

    return generateSurveySingleUseIds(parsedInput.count, parsedInput.isEncrypted);
  });

const ZGetSurveysAction = z.object({
  environmentId: z.cuid2(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  filterCriteria: ZSurveyFilterCriteria.optional(),
});

export const getSurveysAction = authenticatedActionClient
  .inputSchema(ZGetSurveysAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      access: [
        {
          data: parsedInput.filterCriteria,
          schema: ZSurveyFilterCriteria,
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "read",
          projectId: await getProjectIdFromEnvironmentId(parsedInput.environmentId),
        },
      ],
    });

    return await getSurveys(
      parsedInput.environmentId,
      parsedInput.limit,
      parsedInput.offset,
      parsedInput.filterCriteria
    );
  });

const ZValidateSurveyImportAction = z.object({
  surveyData: ZSurveyExportPayload,
  environmentId: z.string().cuid2(),
  importRunId: z.string().optional(),
});

export const validateSurveyImportAction = authenticatedActionClient
  .schema(ZValidateSurveyImportAction)
  .action(async ({ ctx, parsedInput }) => {
    logger.info(
      {
        importRunId: parsedInput.importRunId,
        environmentId: parsedInput.environmentId,
        userId: ctx.user.id,
      },
      "Survey import: validating payload"
    );

    // Step 1: Parse and validate payload structure
    const parseResult = parseSurveyPayload(parsedInput.surveyData);
    if ("error" in parseResult) {
      logger.warn(
        {
          importRunId: parsedInput.importRunId,
          environmentId: parsedInput.environmentId,
          userId: ctx.user.id,
          parseError: parseResult.error,
          parseDetails: parseResult.details,
        },
        "Survey import: validation failed during payload parsing"
      );

      return {
        valid: false,
        errors:
          parseResult.details && parseResult.details.length > 0
            ? [parseResult.error, ...parseResult.details]
            : [parseResult.error],
        warnings: [],
        infos: [],
        surveyName:
          typeof parsedInput.surveyData === "object" &&
          parsedInput.surveyData !== null &&
          "data" in parsedInput.surveyData
            ? ((parsedInput.surveyData.data as { name?: string })?.name ?? "")
            : "",
      };
    }

    const { surveyInput, exportedLanguages, triggers } = parseResult;

    const organizationId = await getOrganizationIdFromEnvironmentId(parsedInput.environmentId);
    const projectId = await getProjectIdFromEnvironmentId(parsedInput.environmentId);

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "readWrite",
          projectId,
        },
      ],
    });

    // Trigger validation is now handled by Zod schema validation

    const infos: string[] = [];
    const languageCodes = exportedLanguages.map((l) => l.code).filter(Boolean);
    if (languageCodes.length > 0) {
      const project = await getProject(projectId);
      const existingLanguageCodes = project?.languages.map((l) => l.code) || [];
      let hasManagePermission = true;
      try {
        await checkAuthorizationUpdated({
          userId: ctx.user.id,
          organizationId,
          access: [
            {
              type: "organization",
              roles: ["owner", "manager"],
            },
            {
              type: "projectTeam",
              minPermission: "manage",
              projectId,
            },
          ],
        });
      } catch {
        hasManagePermission = false;
      }

      const languageResolution = await resolveMissingProjectLanguages({
        importedLanguageCodes: languageCodes,
        existingLanguageCodes,
        hasManagePermission,
        createLanguage: async (code) => {
          try {
            await createLanguage(projectId, { code, alias: null });
          } catch (error) {
            logger.warn(
              {
                importRunId: parsedInput.importRunId,
                environmentId: parsedInput.environmentId,
                projectId,
                languageCode: code,
              },
              "Survey import: failed to auto-create missing language"
            );
            logger.warn(error, "Survey import: auto-create missing language error details");
            throw error;
          }
        },
        refreshExistingLanguageCodes: async () => {
          const refreshedProject = await getProject(projectId);
          return refreshedProject?.languages.map((l) => l.code) || [];
        },
        getLanguageNames,
      });

      if (languageResolution.errorMessage) {
        return {
          valid: false,
          errors: [languageResolution.errorMessage],
          warnings: [],
          infos: [],
          surveyName: surveyInput.name || "",
        };
      }

      if (languageResolution.createdLanguageCodes.length > 0) {
        infos.push("import_info_languages_created");
      }
    }

    const warnings = await buildImportWarnings(surveyInput, organizationId);

    const hasImages = detectImagesInSurvey(surveyInput);
    if (hasImages) {
      warnings.push("import_warning_images");
    }

    if (triggers && triggers.length > 0) {
      infos.push("import_info_triggers");
    }

    infos.push("import_info_quotas");

    logger.info(
      {
        importRunId: parsedInput.importRunId,
        environmentId: parsedInput.environmentId,
        warningsCount: warnings.length,
        infosCount: infos.length,
        questionCount: surveyInput.questions?.length ?? 0,
      },
      "Survey import: validation completed"
    );

    return {
      valid: true,
      errors: [],
      warnings,
      infos,
      surveyName: surveyInput.name || "Imported Survey",
    };
  });

const ZImportSurveyAction = z.object({
  surveyData: ZSurveyExportPayload,
  environmentId: z.string().cuid2(),
  newName: z.string(),
  importRunId: z.string().optional(),
});

const checkImportAuthorization = async (userId: string, environmentId: string): Promise<void> => {
  await checkAuthorizationUpdated({
    userId,
    organizationId: await getOrganizationIdFromEnvironmentId(environmentId),
    access: [
      {
        type: "organization",
        roles: ["owner", "manager"],
      },
      {
        type: "projectTeam",
        minPermission: "readWrite",
        projectId: await getProjectIdFromEnvironmentId(environmentId),
      },
    ],
  });
};

const importSurveyLocally = async ({
  userId,
  surveyData,
  environmentId,
  newName,
  importRunId,
}: {
  userId: string;
  surveyData: z.infer<typeof ZSurveyExportPayload>;
  environmentId: string;
  newName: string;
  importRunId?: string;
}): Promise<{ surveyId: string }> => {
  logger.info(
    {
      importRunId,
      environmentId,
      userId,
      newName,
    },
    "Survey import: starting local import"
  );

  const parseResult = parseSurveyPayload(surveyData);
  if ("error" in parseResult) {
    const errorMessage =
      parseResult.details && parseResult.details.length > 0
        ? `${parseResult.error}:\n${parseResult.details.join("\n")}`
        : parseResult.error;
    throw new Error(`Validation failed: ${errorMessage}`);
  }
  const { surveyInput, exportedLanguages, triggers } = parseResult;
  logger.info(
    {
      importRunId,
      environmentId,
      surveyQuestionCount:
        (surveyInput.questions?.length ?? 0) +
        (surveyInput.blocks?.reduce((count, block) => count + (block.elements?.length ?? 0), 0) ?? 0),
      surveyBlockCount: surveyInput.blocks?.length ?? 0,
      exportedLanguagesCount: exportedLanguages.length,
      triggersCount: triggers.length,
    },
    "Survey import: parsed local payload"
  );

  const organizationId = await getOrganizationIdFromEnvironmentId(environmentId);
  const capabilities = await resolveImportCapabilities(organizationId);
  const triggerResult = await mapTriggers(triggers, environmentId);
  const cleanedSurvey = await stripUnavailableFeatures(surveyInput, environmentId);

  let mappedLanguages: TSurveyLanguageConnection | undefined = undefined;
  let languageCodes: string[] = [];

  if (exportedLanguages.length > 0 && capabilities.hasMultiLanguage) {
    const projectId = await getProjectIdFromEnvironmentId(environmentId);
    const langResult = await mapLanguages(exportedLanguages, projectId);

    if (langResult.mapped.length > 0) {
      mappedLanguages = normalizeLanguagesForCreation(langResult.mapped);
      languageCodes = exportedLanguages.filter((l) => !l.default).map((l) => l.code);
    }
  }

  const surveyWithTranslations = addLanguageLabels(cleanedSurvey, languageCodes);
  const result = await persistSurvey(
    environmentId,
    surveyWithTranslations,
    newName,
    userId,
    triggerResult.mapped,
    mappedLanguages
  );

  logger.info(
    {
      importRunId,
      environmentId,
      surveyId: result.surveyId,
    },
    "Survey import: local import completed"
  );

  return result;
};

export const importSurveyAction = authenticatedActionClient
  .schema(ZImportSurveyAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkImportAuthorization(ctx.user.id, parsedInput.environmentId);
    return await importSurveyLocally({
      userId: ctx.user.id,
      surveyData: parsedInput.surveyData,
      environmentId: parsedInput.environmentId,
      newName: parsedInput.newName,
      importRunId: parsedInput.importRunId,
    });
  });

const ZConvertSurveyDocxAction = z.object({
  environmentId: z.string().cuid2(),
  fileName: z.string().min(1),
  fileBase64: z.string().min(1),
});

export const convertSurveyDocxToPayloadAction = authenticatedActionClient
  .schema(ZConvertSurveyDocxAction)
  .action(async ({ ctx, parsedInput }) => {
    const importRunId = createId();
    logger.info(
      {
        importRunId,
        environmentId: parsedInput.environmentId,
        userId: ctx.user.id,
        fileName: parsedInput.fileName,
      },
      "Survey import: received DOCX conversion request"
    );

    try {
      await checkImportAuthorization(ctx.user.id, parsedInput.environmentId);

      let fileBuffer: Buffer;
      try {
        fileBuffer = Buffer.from(parsedInput.fileBase64, "base64");
      } catch {
        throw new Error("Invalid file payload");
      }

      if (fileBuffer.length === 0) {
        throw new Error("Uploaded file is empty");
      }

      const result = await convertDocxToSurveyPayload(fileBuffer, parsedInput.fileName, {
        importRunId,
        environmentId: parsedInput.environmentId,
        userId: ctx.user.id,
      });

      logger.info(
        {
          importRunId,
          environmentId: parsedInput.environmentId,
          outputQuestionCount:
            (result.surveyData.data.questions?.length ?? 0) +
            (result.surveyData.data.blocks?.reduce(
              (count, block) => count + (Array.isArray(block.elements) ? block.elements.length : 0),
              0
            ) ?? 0),
          outputBlockCount: result.surveyData.data.blocks?.length ?? 0,
        },
        "Survey import: DOCX conversion action completed"
      );

      return {
        ...result,
        importRunId,
      };
    } catch (error) {
      logger.error(
        {
          importRunId,
          environmentId: parsedInput.environmentId,
          userId: ctx.user.id,
          fileName: parsedInput.fileName,
        },
        "Survey import: DOCX conversion action failed"
      );
      logger.error(error, "Survey import: DOCX conversion action error details");
      throw error;
    }
  });

export const importSurveyWithDestinationAction = authenticatedActionClient
  .schema(ZImportSurveyAction)
  .action(async ({ ctx, parsedInput }) => {
    const importRunId = parsedInput.importRunId ?? createId();
    logger.info(
      {
        importRunId,
        environmentId: parsedInput.environmentId,
        userId: ctx.user.id,
        destination: env.SURVEY_IMPORT_DESTINATION ?? "local",
        newName: parsedInput.newName,
      },
      "Survey import: import-with-destination started"
    );

    try {
      await checkImportAuthorization(ctx.user.id, parsedInput.environmentId);

      if (env.SURVEY_IMPORT_DESTINATION === "remote") {
        return await createRemoteSurveyFromPayload(parsedInput.surveyData, parsedInput.newName, {
          importRunId,
          requestedByUserId: ctx.user.id,
        });
      }

      return await importSurveyLocally({
        userId: ctx.user.id,
        surveyData: parsedInput.surveyData,
        environmentId: parsedInput.environmentId,
        newName: parsedInput.newName,
        importRunId,
      });
    } catch (error) {
      logger.error(
        {
          importRunId,
          environmentId: parsedInput.environmentId,
          userId: ctx.user.id,
          destination: env.SURVEY_IMPORT_DESTINATION ?? "local",
          newName: parsedInput.newName,
        },
        "Survey import: import-with-destination failed"
      );
      logger.error(error, "Survey import: import-with-destination error details");
      throw error;
    }
  });
