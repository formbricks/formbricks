import "server-only";
import { z } from "zod";
import { logger } from "@formbricks/logger";
import { ZSurveyType } from "@formbricks/types/surveys/types";
import type { TTemplate } from "@formbricks/types/templates";
import { ZUserLocale } from "@formbricks/types/user";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { problemBadRequest, problemInternalError } from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { CUSTOM_SURVEY_TEMPLATE_ID, getTemplateById } from "@/app/lib/templates";
import { XM_TEMPLATE_IDS } from "@/app/lib/xm-template-ids";
import { replacePresetPlaceholders } from "@/lib/utils/templates";
import { getWorkspace } from "@/lib/workspace/service";
import { getTranslate } from "@/lingodotdev/server";
import { createV3SurveyResponse } from "../../lib/operations";
import { ZV3CreateSurveyBody, formatV3ZodInvalidParams } from "../../schemas";
import { resolveSurveyDefaultLanguage } from "./resolve-default-language";
import { buildV3SurveyCreatePayloadFromTemplate } from "./template-to-v3";

export const ZV3TrustedTemplateCreateBody = z.object({
  workspaceId: z.cuid2(),
  templateId: z.string().trim().min(1),
  source: z.enum(["catalog", "custom", "xm"]),
  surveyType: ZSurveyType,
  defaultLanguage: ZUserLocale,
});

type TTrustedTemplateCreateBody = z.infer<typeof ZV3TrustedTemplateCreateBody>;
type TCreatedFrom = "blank" | "template" | "xm-template";

type TResolvedTemplate = {
  template: TTemplate;
  createdFrom: TCreatedFrom;
  // Canonical BCP-47 code the new survey adopts as its default language (workspace default, or the
  // creator's UI locale when the workspace has no configured default).
  surveyDefaultLanguageCode: string;
};

async function resolveTrustedTemplate(body: TTrustedTemplateCreateBody): Promise<TResolvedTemplate | null> {
  const workspace = await getWorkspace(body.workspaceId);

  if (!workspace) {
    return null;
  }

  // The workspace default language wins over the creator's UI locale; `translationLocale` is the UI
  // locale the template copy is authored in (so built-in labels render in the right language).
  const { surveyDefaultLanguageCode, translationLocale } = resolveSurveyDefaultLanguage({
    requestLocale: body.defaultLanguage,
    workspaceDefaultLanguageCode: workspace.defaultLanguageCode,
    workspaceLanguageCodes: (workspace.languages ?? []).map((language) => language.code),
  });

  const t = await getTranslate(translationLocale);

  if (body.source === "custom" && body.templateId !== CUSTOM_SURVEY_TEMPLATE_ID) {
    return null;
  }

  if (body.source !== "custom" && body.templateId === CUSTOM_SURVEY_TEMPLATE_ID) {
    return null;
  }

  const xmTemplateIds: readonly string[] = XM_TEMPLATE_IDS;
  if (body.source === "xm" && !xmTemplateIds.includes(body.templateId)) {
    return null;
  }

  const template = getTemplateById(body.templateId, t);
  if (!template) {
    return null;
  }

  return {
    template: replacePresetPlaceholders(template, workspace),
    createdFrom: body.source === "custom" ? "blank" : body.source === "xm" ? "xm-template" : "template",
    surveyDefaultLanguageCode,
  };
}

export async function createTrustedTemplateSurveyResponse({
  body,
  authentication,
  requestId,
  instance,
  auditLog,
}: {
  body: TTrustedTemplateCreateBody;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
  auditLog?: TV3AuditLog;
}): Promise<Response> {
  const log = logger.withContext({ requestId, workspaceId: body.workspaceId, templateId: body.templateId });

  try {
    const authResult = await requireV3WorkspaceAccess(
      authentication,
      body.workspaceId,
      "readWrite",
      requestId,
      instance
    );
    if (authResult instanceof Response) {
      return authResult;
    }

    const resolvedTemplate = await resolveTrustedTemplate({
      ...body,
      workspaceId: authResult.workspaceId,
    });
    if (!resolvedTemplate) {
      return problemBadRequest(requestId, "Template not found", {
        invalid_params: [{ name: "templateId", reason: "Unknown template for the requested source" }],
        instance,
      });
    }

    const createBodyResult = ZV3CreateSurveyBody.safeParse(
      buildV3SurveyCreatePayloadFromTemplate({
        template: resolvedTemplate.template,
        workspaceId: authResult.workspaceId,
        surveyType: body.surveyType,
        defaultLanguage: resolvedTemplate.surveyDefaultLanguageCode,
      })
    );

    if (!createBodyResult.success) {
      const invalidParams = formatV3ZodInvalidParams(createBodyResult.error, "data");

      log.warn({ statusCode: 400, invalidParams }, "Trusted template survey create validation failed");

      return problemBadRequest(requestId, "Invalid template survey document", {
        invalid_params: invalidParams,
        instance,
      });
    }

    return await createV3SurveyResponse({
      body: createBodyResult.data,
      authentication,
      requestId,
      instance,
      auditLog,
      authResult,
      createdFrom: resolvedTemplate.createdFrom,
      createOptions: {
        skipExternalUrlPermissionCheck: true,
        surveyCreateInputOverrides: undefined,
      },
    });
  } catch (error) {
    log.error({ error, statusCode: 500 }, "Trusted template survey create unexpected error");
    return problemInternalError(requestId, "An unexpected error occurred.", instance);
  }
}
