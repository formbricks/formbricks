"use server";

import { z } from "zod";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { ZSurveySlug } from "@formbricks/types/surveys/types";
import { assertCan } from "@/lib/authorization";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { getWorkspaceIdFromSurveyId } from "@/lib/utils/helper";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { updateSurveySlug } from "@/modules/survey/lib/slug";

const ZUpdateSurveySlugAction = z.object({
  surveyId: z.cuid2(),
  slug: ZSurveySlug,
});

export const updateSurveySlugAction = authenticatedActionClient
  .inputSchema(ZUpdateSurveySlugAction)
  .action(async ({ ctx, parsedInput }) => {
    if (IS_FORMBRICKS_CLOUD) {
      throw new OperationNotAllowedError("Pretty URLs are only available on self-hosted instances");
    }

    const workspaceId = await getWorkspaceIdFromSurveyId(parsedInput.surveyId);
    await assertCan({ type: "user", id: ctx.user.id }, "workspace.write", {
      type: "workspace",
      id: workspaceId,
    });
    await applyRateLimit(rateLimitConfigs.actions.stateMutation, workspaceId);

    return await updateSurveySlug(parsedInput.surveyId, parsedInput.slug);
  });

const ZRemoveSurveySlugAction = z.object({
  surveyId: z.cuid2(),
});

export const removeSurveySlugAction = authenticatedActionClient
  .inputSchema(ZRemoveSurveySlugAction)
  .action(async ({ ctx, parsedInput }) => {
    if (IS_FORMBRICKS_CLOUD) {
      throw new OperationNotAllowedError("Pretty URLs are only available on self-hosted instances");
    }

    const workspaceId = await getWorkspaceIdFromSurveyId(parsedInput.surveyId);
    await assertCan({ type: "user", id: ctx.user.id }, "workspace.write", {
      type: "workspace",
      id: workspaceId,
    });
    await applyRateLimit(rateLimitConfigs.actions.stateMutation, workspaceId);

    return await updateSurveySlug(parsedInput.surveyId, null);
  });
