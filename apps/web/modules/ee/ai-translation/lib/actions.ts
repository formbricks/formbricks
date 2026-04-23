"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { assertOrganizationAIConfigured } from "@/lib/ai/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import {
  getOrganizationIdFromSurveyId,
  getOrganizationIdFromWorkspaceId,
  getWorkspaceIdFromSurveyId,
} from "@/lib/utils/helper";
import { ZAITranslationField } from "./translate-fields";
import { translateFields } from "./translate-fields";

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

    try {
      await assertOrganizationAIConfigured(organizationId, "smartTools");
      return { available: true };
    } catch {
      return { available: false };
    }
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
