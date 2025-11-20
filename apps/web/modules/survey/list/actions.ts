"use server";

import { z } from "zod";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { ZSurveyFilterCriteria } from "@formbricks/types/surveys/types";
import { getProject } from "@/lib/project/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
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
import { getUserProjects } from "@/modules/survey/list/lib/project";
import {
  copySurveyToOtherEnvironment,
  deleteSurvey,
  getSurvey,
  getSurvey as getSurveyMinimal,
  getSurveys,
} from "@/modules/survey/list/lib/survey";

const ZGetSurveyAction = z.object({
  surveyId: z.string().cuid2(),
});

export const getSurveyAction = authenticatedActionClient
  .schema(ZGetSurveyAction)
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
  surveyId: z.string().cuid2(),
  targetEnvironmentId: z.string().cuid2(),
});

export const copySurveyToOtherEnvironmentAction = authenticatedActionClient
  .schema(ZCopySurveyToOtherEnvironmentAction)
  .action(
    withAuditLogging(
      "copiedToOtherEnvironment",
      "survey",
      async ({
        ctx,
        parsedInput,
      }: {
        ctx: AuthenticatedActionClientCtx;
        parsedInput: z.infer<typeof ZCopySurveyToOtherEnvironmentAction>;
      }) => {
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
          throw new OperationNotAllowedError(
            "Source and target environments must be in the same organization"
          );
        }

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
      }
    )
  );

const ZGetProjectsByEnvironmentIdAction = z.object({
  environmentId: z.string().cuid2(),
});

export const getProjectsByEnvironmentIdAction = authenticatedActionClient
  .schema(ZGetProjectsByEnvironmentIdAction)
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
  surveyId: z.string().cuid2(),
});

export const deleteSurveyAction = authenticatedActionClient.schema(ZDeleteSurveyAction).action(
  withAuditLogging(
    "deleted",
    "survey",
    async ({ ctx, parsedInput }: { ctx: AuthenticatedActionClientCtx; parsedInput: Record<string, any> }) => {
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
    }
  )
);

const ZGenerateSingleUseIdAction = z.object({
  surveyId: z.string().cuid2(),
  isEncrypted: z.boolean(),
  count: z.number().min(1).max(5000).default(1),
});

export const generateSingleUseIdsAction = authenticatedActionClient
  .schema(ZGenerateSingleUseIdAction)
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
  environmentId: z.string().cuid2(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  filterCriteria: ZSurveyFilterCriteria.optional(),
});

export const getSurveysAction = authenticatedActionClient
  .schema(ZGetSurveysAction)
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
});

export const validateSurveyImportAction = authenticatedActionClient
  .schema(ZValidateSurveyImportAction)
  .action(async ({ parsedInput }) => {
    const organizationId = await getOrganizationIdFromEnvironmentId(parsedInput.environmentId);

    // Step 1: Parse and validate payload structure
    const parseResult = parseSurveyPayload(parsedInput.surveyData);
    if ("error" in parseResult) {
      return {
        valid: false,
        errors: [parseResult.error],
        warnings: [],
        infos: [],
        surveyName: parsedInput.surveyData.name || "",
      };
    }

    const { surveyInput, exportedLanguages, triggers } = parseResult;

    // Trigger validation is now handled by Zod schema validation

    const languageCodes = exportedLanguages.map((l) => l.code).filter(Boolean);
    if (languageCodes.length > 0) {
      const projectId = await getProjectIdFromEnvironmentId(parsedInput.environmentId);
      const project = await getProject(projectId);
      const existingLanguageCodes = project?.languages.map((l) => l.code) || [];

      const missingLanguages = languageCodes.filter((code: string) => !existingLanguageCodes.includes(code));

      if (missingLanguages.length > 0) {
        const languageNames = getLanguageNames(missingLanguages);
        return {
          valid: false,
          errors: [
            `Before you can continue, please setup the following languages in your Project Configuration: ${languageNames.join(", ")}`,
          ],
          warnings: [],
          infos: [],
          surveyName: surveyInput.name || "",
        };
      }
    }

    const warnings = await buildImportWarnings(surveyInput, organizationId);
    const infos: string[] = [];

    const hasImages = detectImagesInSurvey(surveyInput);
    if (hasImages) {
      warnings.push("import_warning_images");
    }

    if (triggers && triggers.length > 0) {
      infos.push("import_info_triggers");
    }

    infos.push("import_info_quotas");

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
});

export const importSurveyAction = authenticatedActionClient
  .schema(ZImportSurveyAction)
  .action(async ({ ctx, parsedInput }) => {
    try {
      const organizationId = await getOrganizationIdFromEnvironmentId(parsedInput.environmentId);

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
            projectId: await getProjectIdFromEnvironmentId(parsedInput.environmentId),
          },
        ],
      });

      // Step 1: Parse and validate survey payload
      const parseResult = parseSurveyPayload(parsedInput.surveyData);
      if ("error" in parseResult) {
        const errorMessage = parseResult.details
          ? `${parseResult.error}:\n${parseResult.details.join("\n")}`
          : parseResult.error;
        throw new Error(`Validation failed: ${errorMessage}`);
      }
      const { surveyInput, exportedLanguages, triggers } = parseResult;

      const capabilities = await resolveImportCapabilities(organizationId);

      const triggerResult = await mapTriggers(triggers, parsedInput.environmentId);

      const cleanedSurvey = await stripUnavailableFeatures(surveyInput, parsedInput.environmentId);

      let mappedLanguages: TSurveyLanguageConnection | undefined = undefined;
      let languageCodes: string[] = [];

      if (exportedLanguages.length > 0 && capabilities.hasMultiLanguage) {
        const projectId = await getProjectIdFromEnvironmentId(parsedInput.environmentId);
        const langResult = await mapLanguages(exportedLanguages, projectId);

        if (langResult.mapped.length > 0) {
          mappedLanguages = normalizeLanguagesForCreation(langResult.mapped);
          languageCodes = exportedLanguages.filter((l) => !l.default).map((l) => l.code);
        }
      }

      const surveyWithTranslations = addLanguageLabels(cleanedSurvey, languageCodes);

      const result = await persistSurvey(
        parsedInput.environmentId,
        surveyWithTranslations,
        parsedInput.newName,
        ctx.user.id,
        triggerResult.mapped,
        mappedLanguages
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new Error(errorMessage);
    }
  });
