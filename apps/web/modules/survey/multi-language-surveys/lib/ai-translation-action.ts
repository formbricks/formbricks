"use server";

import { z } from "zod";
import { enqueueAITranslationJob } from "@formbricks/jobs";
import { ZId } from "@formbricks/types/common";
import { assertOrganizationAIConfigured } from "@/lib/ai/service";
import { cache } from "@/lib/cache";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { getAITranslationCacheKey } from "./process-ai-translation-job";

const ZCheckAITranslationAvailableAction = z.object({
  workspaceId: ZId,
});

export const checkAITranslationAvailableAction = authenticatedActionClient
  .inputSchema(ZCheckAITranslationAvailableAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromWorkspaceId(parsedInput.workspaceId);

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "workspaceTeam",
          workspaceId: parsedInput.workspaceId,
          minPermission: "readWrite",
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
  .action(async ({ parsedInput }) => {
    const cacheKey = getAITranslationCacheKey(parsedInput.jobId);
    const result = await cache.get<Record<string, string>>(cacheKey);

    if (!result.ok) {
      return { status: "pending" as const };
    }

    if (result.data === null) {
      return { status: "pending" as const };
    }

    // Clean up after reading
    await cache.del([cacheKey]);

    return { status: "complete" as const, translations: result.data };
  });
