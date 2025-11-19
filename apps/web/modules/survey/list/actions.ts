"use server";

import { z } from "zod";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  TSurveyCreateInput,
  ZSurvey,
  ZSurveyCreateInput,
  ZSurveyFilterCriteria,
} from "@formbricks/types/surveys/types";
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
import { checkMultiLanguagePermission } from "@/modules/ee/multi-language-surveys/lib/actions";
import { createSurvey } from "@/modules/survey/components/template-list/lib/survey";
import { getSurveyFollowUpsPermission } from "@/modules/survey/follow-ups/lib/utils";
import { checkSpamProtectionPermission } from "@/modules/survey/lib/permission";
import { getSurvey as getFullSurvey, getOrganizationBilling } from "@/modules/survey/lib/survey";
import { getProjectIdIfEnvironmentExists } from "@/modules/survey/list/lib/environment";
import {
  detectImagesInSurvey,
  getImportWarnings,
  stripEnterpriseFeatures,
} from "@/modules/survey/list/lib/import-validation";
import { getUserProjects } from "@/modules/survey/list/lib/project";
import {
  copySurveyToOtherEnvironment,
  deleteSurvey,
  getSurvey,
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

    return await getSurvey(parsedInput.surveyId);
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

    return await getFullSurvey(parsedInput.surveyId);
  });

const ZValidateSurveyImportAction = z.object({
  surveyData: z.record(z.any()),
  environmentId: z.string().cuid2(),
});

export const validateSurveyImportAction = authenticatedActionClient
  .schema(ZValidateSurveyImportAction)
  .action(async ({ ctx, parsedInput }) => {
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

    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate with Zod
    const validationResult = ZSurveyCreateInput.safeParse(parsedInput.surveyData);
    if (!validationResult.success) {
      errors.push("import_error_validation");
    }

    // Check for images
    const hasImages = detectImagesInSurvey(parsedInput.surveyData);

    // Check permissions
    let permissions = {
      hasMultiLanguage: true,
      hasFollowUps: true,
      hasRecaptcha: true,
    };

    try {
      await checkMultiLanguagePermission(organizationId);
    } catch {
      permissions.hasMultiLanguage = false;
    }

    try {
      const organizationBillingData = await getOrganizationBilling(organizationId);
      if (organizationBillingData) {
        const isFollowUpsEnabled = await getSurveyFollowUpsPermission(organizationBillingData.plan);
        if (!isFollowUpsEnabled) {
          permissions.hasFollowUps = false;
        }
      }
    } catch {
      permissions.hasFollowUps = false;
    }

    try {
      await checkSpamProtectionPermission(organizationId);
    } catch {
      permissions.hasRecaptcha = false;
    }

    // Get warnings
    const importWarnings = getImportWarnings(parsedInput.surveyData, hasImages, permissions);

    return {
      valid: errors.length === 0,
      errors,
      warnings: importWarnings,
      surveyName: parsedInput.surveyData?.name || "Imported Survey",
      hasImages,
      willStripFeatures: {
        multiLanguage:
          !permissions.hasMultiLanguage && (parsedInput.surveyData?.languages?.length > 1 || false),
        followUps: !permissions.hasFollowUps && (parsedInput.surveyData?.followUps?.length > 0 || false),
        recaptcha: !permissions.hasRecaptcha && (parsedInput.surveyData?.recaptcha?.enabled || false),
      },
    };
  });

const ZImportSurveyAction = z.object({
  surveyData: z.record(z.any()),
  environmentId: z.string().cuid2(),
  newName: z.string(),
});

export const importSurveyAction = authenticatedActionClient
  .schema(ZImportSurveyAction)
  .action(async ({ ctx, parsedInput }) => {
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

    // Re-validate
    const validationResult = ZSurveyCreateInput.safeParse(parsedInput.surveyData);
    if (!validationResult.success) {
      throw new Error("Survey validation failed");
    }

    // Check permissions and strip features
    let permissions = {
      hasMultiLanguage: true,
      hasFollowUps: true,
      hasRecaptcha: true,
    };

    try {
      await checkMultiLanguagePermission(organizationId);
    } catch {
      permissions.hasMultiLanguage = false;
    }

    try {
      const organizationBillingData = await getOrganizationBilling(organizationId);
      if (organizationBillingData) {
        const isFollowUpsEnabled = await getSurveyFollowUpsPermission(organizationBillingData.plan);
        if (!isFollowUpsEnabled) {
          permissions.hasFollowUps = false;
        }
      }
    } catch {
      permissions.hasFollowUps = false;
    }

    try {
      await checkSpamProtectionPermission(organizationId);
    } catch {
      permissions.hasRecaptcha = false;
    }

    // Prepare survey for import
    let importedSurvey = stripEnterpriseFeatures(validationResult.data, permissions);
    importedSurvey.name = parsedInput.newName;
    importedSurvey.segment = null;
    importedSurvey.environmentId = parsedInput.environmentId;

    // Create the survey
    const result = await createSurvey(parsedInput.environmentId, importedSurvey, ctx.user.id);

    return result;
  });
