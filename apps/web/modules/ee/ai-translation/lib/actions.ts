"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { assertOrganizationAIConfigured, getOrganizationAIConfig } from "@/lib/ai/service";
import { assertCan } from "@/lib/authorization";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { getOrganizationIdFromSurveyId, getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { translateFields } from "./translate-fields";
import { ZTranslateSurveyFieldsInput, getAITranslationLanguageName } from "./translation-languages";

const ZCheckAITranslationAvailableAction = z.object({
  surveyId: ZId,
});

export const checkAITranslationAvailableAction = authenticatedActionClient
  .inputSchema(ZCheckAITranslationAvailableAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromSurveyId(parsedInput.surveyId);
    await assertCan({ type: "user", id: ctx.user.id }, "survey.read", {
      type: "survey",
      id: parsedInput.surveyId,
    });

    const aiConfig = await getOrganizationAIConfig(organizationId);

    if (!aiConfig.isAISmartToolsEntitled) {
      return { available: false, reason: "not_in_plan" as const };
    }

    if (!aiConfig.isAISmartToolsEnabled) {
      return { available: false, reason: "not_enabled" as const };
    }

    if (!aiConfig.isInstanceConfigured) {
      return { available: false, reason: "instance_not_configured" as const };
    }

    return { available: true };
  });

export const translateSurveyFieldsAction = authenticatedActionClient
  .inputSchema(ZTranslateSurveyFieldsInput)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromWorkspaceId(parsedInput.workspaceId);

    await assertCan({ type: "user", id: ctx.user.id }, "workspace.write", {
      type: "workspace",
      id: parsedInput.workspaceId,
    });

    await applyRateLimit(rateLimitConfigs.actions.aiTranslation, ctx.user.id);

    await assertOrganizationAIConfigured(organizationId);

    const outcome = await translateFields({
      organizationId,
      workspaceId: parsedInput.workspaceId,
      userId: ctx.user.id,
      fields: parsedInput.fields,
      sourceLanguage: getAITranslationLanguageName(parsedInput.sourceLanguage),
      targetLanguage: getAITranslationLanguageName(parsedInput.targetLanguage),
    });

    return outcome;
  });
