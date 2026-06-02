"use server";

import { z } from "zod";
import { logger } from "@formbricks/logger";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { ZSurveyType } from "@formbricks/types/surveys/types";
import { createV3SurveyFromTrustedTemplate } from "@/app/api/v3/surveys/create";
import { prepareV3SurveyCreateInput } from "@/app/api/v3/surveys/prepare";
import { CUSTOM_SURVEY_TEMPLATE_ID, getTemplateById } from "@/app/lib/templates";
import { DEFAULT_LOCALE } from "@/lib/constants";
import { capturePostHogEvent } from "@/lib/posthog";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { replacePresetPlaceholders } from "@/lib/utils/templates";
import { getWorkspace } from "@/lib/workspace/service";
import { getTranslate } from "@/lingodotdev/server";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { buildV3SurveyCreatePayloadFromTemplate } from "./lib/template-to-v3";

const ZCreateSurveyAction = z
  .object({
    workspaceId: z.cuid2(),
    templateId: z.string().min(1),
    surveyType: ZSurveyType,
  })
  .strict();

const log = logger.withContext({ module: "template-list-actions" });

export const createSurveyAction = authenticatedActionClient.inputSchema(ZCreateSurveyAction).action(
  withAuditLogging("created", "survey", async ({ ctx, parsedInput }) => {
    const workspaceId = parsedInput.workspaceId;
    const templateId = parsedInput.templateId;
    const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "workspaceTeam",
          minPermission: "readWrite",
          workspaceId,
        },
      ],
    });

    const locale = ctx.user.locale ?? DEFAULT_LOCALE;
    const t = await getTranslate(locale);
    const template = getTemplateById(templateId, t);
    if (!template) {
      throw new InvalidInputError(`Template '${templateId}' not found`);
    }

    const workspace = await getWorkspace(workspaceId);
    if (!workspace) {
      throw new ResourceNotFoundError("Workspace", workspaceId);
    }

    const templateWithPlaceholders = replacePresetPlaceholders(template, workspace);
    const payload = buildV3SurveyCreatePayloadFromTemplate({
      template: templateWithPlaceholders,
      workspaceId,
      surveyType: parsedInput.surveyType,
      defaultLanguage: locale,
    });
    const preparation = prepareV3SurveyCreateInput(payload);

    if (!preparation.ok) {
      const firstInvalidParam = preparation.validation.invalidParams[0];
      log.warn(
        {
          workspaceId,
          templateId,
          invalidParams: preparation.validation.invalidParams.map((invalidParam) => invalidParam.name),
        },
        "Template generated an invalid v3 survey document"
      );
      throw new InvalidInputError(
        firstInvalidParam
          ? `Invalid template survey document: ${firstInvalidParam.name}: ${firstInvalidParam.reason}`
          : "Invalid template survey document"
      );
    }

    const result = await createV3SurveyFromTrustedTemplate(preparation.document, {
      user: ctx.user,
      expires: "",
    });
    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.surveyId = result.id;
    ctx.auditLoggingCtx.newObject = result;

    const createdFrom = templateId === CUSTOM_SURVEY_TEMPLATE_ID ? "blank" : "template";

    capturePostHogEvent(
      ctx.user.id,
      "survey_created",
      {
        survey_id: result.id,
        survey_type: result.type,
        organization_id: organizationId,
        workspace_id: workspaceId,
        question_count: result.questions?.length ?? 0,
        created_from: createdFrom,
      },
      { organizationId, workspaceId }
    );

    return result;
  })
);
