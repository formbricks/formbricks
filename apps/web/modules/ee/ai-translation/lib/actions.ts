"use server";

import { z } from "zod";
import { enqueueAITranslationJob } from "@formbricks/jobs";
import { ZId } from "@formbricks/types/common";
import { assertOrganizationAIConfigured } from "@/lib/ai/service";
import { cache } from "@/lib/cache";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import {
  getOrganizationIdFromSurveyId,
  getOrganizationIdFromWorkspaceId,
  getWorkspaceIdFromSurveyId,
} from "@/lib/utils/helper";
import { getAITranslationCacheKey } from "./process-ai-translation-job";

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

const ZTranslateField = z.object({
  path: z.string(),
  defaultText: z.string(),
  isRichText: z.boolean(),
});

const ZTranslateSurveyFieldsAction = z.object({
  workspaceId: ZId,
  fields: z.array(ZTranslateField).min(1),
  sourceLanguage: z.string(),
  targetLanguage: z.string(),
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

    // Ensure AI is configured before enqueuing
    await assertOrganizationAIConfigured(organizationId, "smartTools");

    const job = await enqueueAITranslationJob({
      organizationId,
      workspaceId: parsedInput.workspaceId,
      userId: ctx.user.id,
      fields: parsedInput.fields,
      sourceLanguage: parsedInput.sourceLanguage,
      targetLanguage: parsedInput.targetLanguage,
    });

    return { jobId: String(job.id) };
  });

const ZGetAITranslationResultAction = z.object({
  jobId: z.string().min(1),
});

export const getAITranslationResultAction = authenticatedActionClient
  .inputSchema(ZGetAITranslationResultAction)
  .action(async ({ ctx, parsedInput }) => {
    const cacheKey = getAITranslationCacheKey(parsedInput.jobId);
    const result = await cache.get<{
      userId: string;
      translations?: Record<string, string>;
      error?: string;
    }>(cacheKey);

    if (!result.ok) {
      return { status: "pending" as const };
    }

    if (result.data === null) {
      return { status: "pending" as const };
    }

    // Verify the requesting user owns this translation result
    if (result.data.userId !== ctx.user.id) {
      throw new Error("Not authorized");
    }

    // Check if the job failed
    if (result.data.error) {
      return { status: "failed" as const, error: result.data.error };
    }

    // Let the 5-minute TTL handle cleanup — eager deletion risks losing
    // the result if the response is dropped before the client receives it.
    return { status: "complete" as const, translations: result.data.translations! };
  });
