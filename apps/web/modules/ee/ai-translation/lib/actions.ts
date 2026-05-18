"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { assertOrganizationAIConfigured, getOrganizationAIConfig } from "@/lib/ai/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import {
  getOrganizationIdFromSurveyId,
  getOrganizationIdFromWorkspaceId,
  getWorkspaceIdFromSurveyId,
} from "@/lib/utils/helper";
import { ZAITranslationField, translateFields } from "./translate-fields";

const ZCheckAITranslationAvailableAction = z.object({
  surveyId: ZId,
});

export const checkAITranslationAvailableAction = authenticatedActionClient
  .inputSchema(ZCheckAITranslationAvailableAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromSurveyId(parsedInput.surveyId);
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
          minPermission: "read",
          workspaceId: await getWorkspaceIdFromSurveyId(parsedInput.surveyId),
        },
      ],
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

const ZTranslateSurveyFieldsAction = z.object({
  workspaceId: ZId,
  fields: z.array(ZAITranslationField).min(1),
  sourceLanguage: z.string().min(1),
  targetLanguage: z.string().min(1),
});

export const translateSurveyFieldsAction = authenticatedActionClient
  .inputSchema(ZTranslateSurveyFieldsAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromWorkspaceId(parsedInput.workspaceId);

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
          workspaceId: parsedInput.workspaceId,
          minPermission: "readWrite",
        },
      ],
    });

    await assertOrganizationAIConfigured(organizationId, "smartTools");

    const translations = await translateFields({
      organizationId,
      fields: parsedInput.fields,
      sourceLanguage: parsedInput.sourceLanguage,
      targetLanguage: parsedInput.targetLanguage,
    });

    return { translations };
  });
